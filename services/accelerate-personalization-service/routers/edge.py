import hashlib
import json
import logging
import uuid
from fastapi import APIRouter, Query, Response
from fastapi.responses import PlainTextResponse

from core.config import get_settings
from core.database import get_pool
from services.experiment_engine import assign_variant

logger = logging.getLogger(__name__)
router = APIRouter()

# Redis client — lazy init
_redis_client = None


async def _get_redis():
    """Lazy Redis connection with graceful degradation."""
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            settings = get_settings()
            _redis_client = await aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            await _redis_client.ping()
        except Exception as e:
            logger.warning("Redis unavailable, proceeding without cache: %s", e)
            _redis_client = None
    return _redis_client


async def _cache_get(key: str) -> dict | None:
    try:
        r = await _get_redis()
        if r is None:
            return None
        val = await r.get(key)
        if val:
            return json.loads(val)
    except Exception as e:
        logger.warning("Redis GET failed: %s", e)
    return None


async def _cache_set(key: str, value: dict, ttl: int) -> None:
    try:
        r = await _get_redis()
        if r is None:
            return
        await r.setex(key, ttl, json.dumps(value))
    except Exception as e:
        logger.warning("Redis SET failed: %s", e)


@router.get("/resolve")
async def resolve_edge(
    org_id: str = Query(...),
    url: str = Query(...),
    visitor_id: str = Query(default=None),
):
    settings = get_settings()

    # Generate visitor_id if not provided
    if not visitor_id:
        visitor_id = str(uuid.uuid4())

    # Build cache key from url hash to keep key size manageable
    url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
    cache_key = f"edge:{org_id}:{url_hash}:{visitor_id}"

    # Try cache hit
    cached = await _cache_get(cache_key)
    if cached:
        logger.debug("Edge cache HIT: %s", cache_key)
        return cached

    pool = await get_pool()

    # Find matching SitePage — exact match first, then case-insensitive LIKE
    page = await pool.fetchrow(
        'SELECT id FROM "SitePage" WHERE "organizationId" = $1 AND url = $2 AND "isActive" = true',
        org_id, url,
    )
    if not page:
        # Try prefix match (page URL may be stored without query string)
        base_url = url.split("?")[0].rstrip("/")
        page = await pool.fetchrow(
            """SELECT id FROM "SitePage"
               WHERE "organizationId" = $1
               AND url ILIKE $2
               AND "isActive" = true
               LIMIT 1""",
            org_id, f"{base_url}%",
        )

    if not page:
        response = {"visitor_id": visitor_id, "zones": []}
        # Cache miss response briefly (5s) to avoid DB hammering on unknown URLs
        await _cache_set(cache_key, response, 5)
        return response

    page_id = str(page["id"])

    # Get all zones for page
    zones = await pool.fetch(
        'SELECT id, selector, "defaultHtml" FROM "PersonalizationZone" WHERE "pageId" = $1',
        page_id,
    )

    result_zones = []
    for zone in zones:
        zone_id = str(zone["id"])
        selector = zone["selector"]
        default_html = zone["defaultHtml"] or ""

        # Find running experiment for this zone
        experiment = await pool.fetchrow(
            """SELECT id, "holdoutPct", "allocationMode"
               FROM "Experiment"
               WHERE "zoneId" = $1 AND status = 'running'
               LIMIT 1""",
            zone_id,
        )

        if not experiment:
            result_zones.append({
                "zone_id": zone_id,
                "selector": selector,
                "html": default_html,
                "variant_id": None,
                "experiment_id": None,
            })
            continue

        experiment_id = str(experiment["id"])
        holdout_pct = experiment["holdoutPct"] or 0
        allocation_mode = experiment["allocationMode"] or "random"

        # Get variant allocations
        allocations = await pool.fetch(
            """SELECT "variantId", weight, "isControl"
               FROM "ExperimentVariantAllocation"
               WHERE "experimentId" = $1""",
            experiment_id,
        )
        alloc_list = [dict(a) for a in allocations]

        # Get bandit stats if bandit mode
        bandit_stats = []
        if allocation_mode == "bandit":
            bs_rows = await pool.fetch(
                'SELECT "variantId", impressions, conversions FROM "BanditStat" WHERE "experimentId" = $1',
                experiment_id,
            )
            bandit_stats = [dict(b) for b in bs_rows]

        assigned_variant_id = await assign_variant(
            visitor_id=visitor_id,
            experiment_id=experiment_id,
            allocations=alloc_list,
            holdout_pct=holdout_pct,
            allocation_mode=allocation_mode,
            bandit_stats=bandit_stats,
        )

        # Holdout — serve default
        if assigned_variant_id is None:
            result_zones.append({
                "zone_id": zone_id,
                "selector": selector,
                "html": default_html,
                "variant_id": None,
                "experiment_id": experiment_id,
            })
            continue

        # Fetch variant HTML
        variant = await pool.fetchrow(
            'SELECT id, html FROM "PageVariant" WHERE id = $1',
            assigned_variant_id,
        )
        html = variant["html"] if variant else default_html

        result_zones.append({
            "zone_id": zone_id,
            "selector": selector,
            "html": html,
            "variant_id": assigned_variant_id,
            "experiment_id": experiment_id,
        })

    response = {"visitor_id": visitor_id, "zones": result_zones}

    # Cache result
    await _cache_set(cache_key, response, settings.edge_cache_ttl)

    return response


@router.get("/loader.js", response_class=PlainTextResponse)
async def edge_loader(
    org_id: str = Query(...),
    pixel_url: str = Query(default="/api/pixel"),
):
    """
    Returns a JavaScript snippet for client-side personalization.
    Embed via: <script src="/edge/loader.js?org_id=YOUR_ORG_ID" defer></script>
    """
    js = f"""
(function() {{
  'use strict';

  // --- Visitor ID ---
  function getCookie(name) {{
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }}

  function setCookie(name, value, days) {{
    var expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + value + '; expires=' + expires + '; path=/; SameSite=Lax';
  }}

  var COOKIE_NAME = '_accel_vid';
  var visitorId = getCookie(COOKIE_NAME);
  if (!visitorId) {{
    visitorId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {{
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }});
    setCookie(COOKIE_NAME, visitorId, 365);
  }}

  // --- Resolve personalization ---
  var orgId = '{org_id}';
  var currentUrl = encodeURIComponent(window.location.href);
  var resolveUrl = '/edge/resolve?org_id=' + orgId + '&url=' + currentUrl + '&visitor_id=' + visitorId;

  function applyZones(data) {{
    if (!data || !data.zones) return;
    data.zones.forEach(function(zone) {{
      if (!zone.selector || !zone.html) return;
      var el = document.querySelector(zone.selector);
      if (el) {{
        el.innerHTML = zone.html;
      }}
      // Record impression
      if (zone.experiment_id && zone.variant_id) {{
        sendImpression(zone);
      }}
    }});
  }}

  function sendImpression(zone) {{
    try {{
      var pixelUrl = '{pixel_url}?event=impression' +
        '&experiment_id=' + encodeURIComponent(zone.experiment_id) +
        '&variant_id=' + encodeURIComponent(zone.variant_id) +
        '&visitor_id=' + encodeURIComponent(visitorId);
      // Use sendBeacon if available, else fire-and-forget fetch
      if (navigator.sendBeacon) {{
        navigator.sendBeacon(pixelUrl);
      }} else {{
        fetch(pixelUrl, {{ method: 'GET', keepalive: true }}).catch(function() {{}});
      }}
    }} catch(e) {{}}
  }}

  // Fetch and apply
  fetch(resolveUrl)
    .then(function(res) {{ return res.json(); }})
    .then(function(data) {{ applyZones(data); }})
    .catch(function(err) {{ console.warn('[Accelerate] Personalization resolve failed:', err); }});

}})();
""".strip()

    return Response(
        content=js,
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=300"},
    )

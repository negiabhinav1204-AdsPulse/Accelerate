"""AI-powered feed optimization using LiteLLM proxy and rule-based custom labels.

Used by the feeds and merchant_center routers to enrich product data before
pushing to Google Shopping / GMC.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx

from core.config import get_settings

logger = logging.getLogger(__name__)

# ── LiteLLM proxy URL (set via env var LITELLM_BASE_URL) ────────────────────
_LITELLM_TIMEOUT = 30


def _litellm_url() -> str:
    """Return the LiteLLM proxy base URL, or empty string if not configured."""
    import os
    return os.environ.get("LITELLM_BASE_URL", "").rstrip("/")


# ── AI Title / Description Optimization ────────────────────────────────────


async def optimize_product_titles(products: list[dict], org_id: str) -> list[dict]:
    """Use LLM to rewrite product titles/descriptions for Google Shopping best practices.

    Rules applied by the model:
    - Lead with brand name if available
    - Include key attributes: color, size, material extracted from title/description
    - Keep title under 150 characters
    - Include primary keyword naturally

    Falls back gracefully to rule-based optimization if LiteLLM is unavailable.

    Args:
        products: List of product dicts with at least 'id', 'title', 'description',
                  and optionally 'brand' fields.
        org_id: Organisation identifier (used for context/logging).

    Returns:
        List of dicts: {product_id, optimized_title, optimized_description}.
    """
    results: list[dict] = []

    litellm_base = _litellm_url()

    if litellm_base:
        try:
            results = await _optimize_via_llm(products, org_id, litellm_base)
            return results
        except Exception as exc:
            logger.warning("LLM optimization failed (org=%s), falling back to rules: %s", org_id, exc)

    # Rule-based fallback
    for product in products:
        results.append(_rule_based_optimize(product))

    return results


async def _optimize_via_llm(products: list[dict], org_id: str, litellm_base: str) -> list[dict]:
    """Call LiteLLM proxy to batch-optimize titles and descriptions."""
    # Build a compact product list for the prompt (avoid token bloat)
    product_summaries = []
    for p in products:
        product_summaries.append({
            "id": str(p.get("id", "")),
            "title": (p.get("title") or "")[:200],
            "description": (p.get("description") or "")[:500],
            "brand": (p.get("brand") or ""),
        })

    system_prompt = (
        "You are a Google Shopping feed specialist. "
        "Rewrite product titles and descriptions to maximise click-through rate and Google Shopping quality score. "
        "Rules: (1) Lead with brand name if provided. (2) Include key attributes (color, size, material) if detectable. "
        "(3) Max 150 chars for title. (4) Max 5000 chars for description. "
        "(5) Keep descriptions informative and natural. "
        "Return a JSON array of objects: [{\"product_id\": \"...\", \"optimized_title\": \"...\", \"optimized_description\": \"...\"}]. "
        "Return ONLY the JSON array, no markdown."
    )
    user_prompt = f"Optimise these {len(product_summaries)} products:\n{json.dumps(product_summaries, ensure_ascii=False)}"

    async with httpx.AsyncClient(timeout=_LITELLM_TIMEOUT) as client:
        resp = await client.post(
            f"{litellm_base}/chat/completions",
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    raw_content = data["choices"][0]["message"]["content"].strip()

    # Strip markdown fences if present
    if raw_content.startswith("```"):
        lines = raw_content.splitlines()
        raw_content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    parsed: list[dict] = json.loads(raw_content)

    # Validate and normalise
    results = []
    for item in parsed:
        results.append({
            "product_id": str(item.get("product_id", "")),
            "optimized_title": (item.get("optimized_title") or "")[:150],
            "optimized_description": (item.get("optimized_description") or "")[:5000],
        })

    logger.info("LLM optimised %d products for org=%s", len(results), org_id)
    return results


def _rule_based_optimize(product: dict) -> dict:
    """Rule-based title/description optimisation fallback (no LLM required)."""
    title = (product.get("title") or "").strip()
    description = (product.get("description") or "").strip()
    brand = (product.get("brand") or "").strip()

    # Build optimised title: "Brand — Title" (if brand not already present)
    if brand and brand.lower() not in title.lower():
        optimized_title = f"{brand} — {title}"
    else:
        optimized_title = title

    if len(optimized_title) > 150:
        optimized_title = optimized_title[:147] + "..."

    # Build optimised description
    if not description:
        parts = []
        if brand:
            parts.append(f"From {brand}.")
        parts.append(f"Shop the {title}.")
        parts.append("Free shipping on qualifying orders.")
        optimized_description = " ".join(parts)
    elif len(description) < 100:
        extra = []
        if brand and brand.lower() not in description.lower():
            extra.append(f"By {brand}.")
        extra.append("Free shipping on qualifying orders.")
        optimized_description = description + " " + " ".join(extra)
    else:
        optimized_description = description[:5000]

    return {
        "product_id": str(product.get("id", "")),
        "optimized_title": optimized_title,
        "optimized_description": optimized_description,
    }


# ── Custom Label Assignment ─────────────────────────────────────────────────


def assign_custom_labels(products: list[dict], orders_summary: dict) -> list[dict]:
    """Assign Google Shopping custom labels based on performance data.

    Labels assigned:
    - label_0 (segment): best_seller | trending | new_arrival | zombie_sku | standard
    - label_1 (margin_tier): high_margin | standard | low_margin  (based on price)
    - label_2 (trending_status): trending | stable | declining
    - label_3 (price_tier): premium (>=100) | mid (>=30) | budget (<30)
    - label_4 (promo_status): on_sale | full_price

    Args:
        products: List of product dicts. Each must have 'id', 'price', 'createdAt'
                  (or 'created_at'), 'inventoryQty' (or 'inventory_qty'), and optionally 'tags'.
        orders_summary: Dict keyed by product_id with sub-keys:
            {
                revenue_l7d: float,   # last 7-day revenue
                revenue_p7d: float,   # prior 7-day revenue
                revenue_total: float, # total revenue in window
                last_sale_at: str,    # ISO datetime of last order item
            }

    Returns:
        List of {product_id, custom_labels: dict} where custom_labels maps
        label_0 through label_4 to string values.
    """
    if not products:
        return []

    # ── Compute revenue thresholds for best_seller (top 20%) ──
    revenues = [orders_summary.get(str(p.get("id", "")), {}).get("revenue_total", 0.0) for p in products]
    revenues_nonzero = sorted([r for r in revenues if r > 0], reverse=True)
    top20_threshold = revenues_nonzero[max(int(len(revenues_nonzero) * 0.2) - 1, 0)] if revenues_nonzero else 0.0

    # ── Average price for margin tier ──
    prices = [float(p.get("price") or 0) for p in products if float(p.get("price") or 0) > 0]
    avg_price = sum(prices) / len(prices) if prices else 0.0

    now = datetime.now(timezone.utc)
    results = []

    for product in products:
        product_id = str(product.get("id", ""))
        perf = orders_summary.get(product_id, {})

        revenue_total = float(perf.get("revenue_total", 0.0))
        revenue_l7d = float(perf.get("revenue_l7d", 0.0))
        revenue_p7d = float(perf.get("revenue_p7d", 0.0))
        last_sale_at = perf.get("last_sale_at")

        price = float(product.get("price") or 0)
        tags = (product.get("tags") or "").lower()

        # ── created_at ──
        created_at_raw = product.get("createdAt") or product.get("created_at")
        created_at: datetime | None = None
        if created_at_raw:
            try:
                if isinstance(created_at_raw, datetime):
                    created_at = created_at_raw if created_at_raw.tzinfo else created_at_raw.replace(tzinfo=timezone.utc)
                else:
                    created_at = datetime.fromisoformat(str(created_at_raw).replace("Z", "+00:00"))
            except (ValueError, TypeError):
                created_at = None

        # ── inventory ──
        inventory_qty = int(product.get("inventoryQty") or product.get("inventory_qty") or 0)

        # ── label_0: segment ──
        is_best_seller = revenue_total > 0 and revenue_total >= top20_threshold
        is_trending = (revenue_p7d > 0 and revenue_l7d > revenue_p7d * 1.5) or (revenue_l7d > 0 and revenue_p7d == 0)
        is_new_arrival = created_at is not None and (now - created_at).days <= 14

        # zombie_sku: no sales in 60+ days AND has stock
        is_zombie = False
        if last_sale_at:
            try:
                last_sale_dt = datetime.fromisoformat(str(last_sale_at).replace("Z", "+00:00"))
                if (now - last_sale_dt).days >= 60 and inventory_qty > 0:
                    is_zombie = True
            except (ValueError, TypeError):
                pass
        elif revenue_total == 0 and inventory_qty > 0:
            is_zombie = True

        if is_best_seller:
            segment = "best_seller"
        elif is_trending:
            segment = "trending"
        elif is_new_arrival:
            segment = "new_arrival"
        elif is_zombie:
            segment = "zombie_sku"
        else:
            segment = "standard"

        # ── label_1: margin_tier ──
        if avg_price > 0 and price >= 2 * avg_price:
            margin_tier = "high_margin"
        elif price >= 50:
            margin_tier = "standard"
        else:
            margin_tier = "low_margin"

        # ── label_2: trending_status ──
        if is_trending:
            trending_status = "trending"
        elif is_zombie or (revenue_p7d > 0 and revenue_l7d < revenue_p7d * 0.5):
            trending_status = "declining"
        else:
            trending_status = "stable"

        # ── label_3: price_tier ──
        if price >= 100:
            price_tier = "premium"
        elif price >= 30:
            price_tier = "mid"
        else:
            price_tier = "budget"

        # ── label_4: promo_status ──
        if any(kw in tags for kw in ["sale", "clearance", "discount", "promo", "offer"]):
            promo_status = "on_sale"
        else:
            promo_status = "full_price"

        results.append({
            "product_id": product_id,
            "custom_labels": {
                "label_0": segment,
                "label_1": margin_tier,
                "label_2": trending_status,
                "label_3": price_tier,
                "label_4": promo_status,
            },
        })

    return results

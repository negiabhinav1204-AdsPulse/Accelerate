"""Step 5: Build — per-campaign parallel text + image generation.

V2 structure (from campaign_creator.py + pipeline.py):
  asyncio.gather(                         # ALL campaigns in parallel
      creator.create(c1) → gather(text, image),  # per-campaign parallel
      creator.create(c2) → gather(text, image),
      ...
  )

Each campaign runs text + images concurrently.
All campaigns run in parallel with each other.
Logo fetched once, shared across all campaigns.
"""

import asyncio
import logging
import time
from typing import Any, Dict

import httpx

from src.agentic_platform.core.config import settings
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.core.infra.image.models import ImageGenParams
from src.agentic_platform.core.infra.image.provider import ImageGateway
from src.agentic_platform.core.infra.gcs_client import GCSClient
from src.agentic_platform.core.engine.models import NodeResponse
from src.agentic_platform.core.engine.workflow import WorkflowContext
from src.agentic_platform.core.engine.workflow import StepArtifact
from src.agentic_platform.app.campaigns.models import (
    WebsiteContent,
    CampaignContext,
    CreateCampaignArgs, CreativePreferences,
    V2CampaignConfig, V2CampaignPlan,
    CampaignType as CampaignTypeEnum,
    TEMPLATE_TEXT_ASSET_MAP, TEMPLATE_IMAGE_SLOTS,
    BuiltCampaignAssets, BuildStepData,
)
from src.agentic_platform.app.campaigns.prompts import build_image_prompt, ratio_to_size
from src.agentic_platform.app.campaigns.keyword_generator import generate_keywords
from src.agentic_platform.app.campaigns.services import campaign_client

logger = logging.getLogger(__name__)

_gateway: ImageGateway | None = None
_gcs: GCSClient | None = None


def _get_gateway() -> ImageGateway:
    global _gateway
    if _gateway is None:
        _gateway = ImageGateway()
    return _gateway


def _get_gcs() -> GCSClient:
    global _gcs
    if _gcs is None:
        _gcs = GCSClient()
    return _gcs

_REJECTED_CT = frozenset({"image/svg+xml", "text/html", "text/xml", "application/xml"})

# ── Canonical ad platform dimensions ──────────────────────────────
# After generation, crop + resize to these exact pixel sizes.
# Per Google & Microsoft PMax image asset specs.
_CANONICAL_SIZES: dict[str, tuple[int, int]] = {
    "1.91:1": (1200, 628),   # Landscape marketing — Google rec & Bing rec
    "1:1":    (1200, 1200),   # Square marketing
    "4:5":    (960, 1200),    # Portrait — Google PMax
    "1:2":    (600, 1200),    # Vertical — Microsoft PMax (NOT the same as Google 4:5)
}


def _crop_to_ratio(image_bytes: bytes, target_ratio: str) -> bytes:
    """Center-crop and resize to canonical ad platform dimensions."""
    canonical = _CANONICAL_SIZES.get(target_ratio)
    if canonical is None:
        return image_bytes

    from PIL import Image
    import io

    img = Image.open(io.BytesIO(image_bytes))
    w, h = img.size
    target_w, target_h = canonical
    target_r = target_w / target_h
    current_r = w / h

    # Center-crop to target aspect ratio
    if abs(current_r - target_r) > 0.01:
        if target_r > current_r:
            # Target is wider → trim height
            new_h = round(w / target_r)
            top = (h - new_h) // 2
            img = img.crop((0, top, w, top + new_h))
        else:
            # Target is taller → trim width
            new_w = round(h * target_r)
            left = (w - new_w) // 2
            img = img.crop((left, 0, left + new_w, h))

    # Resize to exact canonical dimensions
    if img.size != (target_w, target_h):
        img = img.resize((target_w, target_h), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

_TEXT_SYSTEM_PROMPT = (
    "You are an expert advertising copywriter. "
    "Generate high-quality ad text assets based on the campaign configuration provided. "
    "Respect all character-length limits defined in the output schema. "
    "Use the ad_context (brand, products, audience, tone) to craft compelling copy. "
    "CAPITALIZATION RULE: Never use ALL-CAPS words in headlines or descriptions "
    "(e.g. write 'Free Shipping Today' NOT 'FREE SHIPPING TODAY'). "
    "Google Ads will reject the ad with a CAPITALIZATION policy violation. "
    "Use natural title case or sentence case instead. "
    "IMPORTANT: For the finalUrl field, you MUST use exactly: {landing_url} — "
    "do NOT invent, modify, or hallucinate any URL."
)


async def _gen_image(
    desc: str, slot_name: str, aspect_ratio: str, variation_idx: int,
    brand_context: str, website: "WebsiteContent", org_id: str,
    image_style: str = "", image_mood: str = "",
    brand_colors: list[str] | None = None,
    audience_age_min: int = 0,
    audience_age_max: int = 0,
    audience_gender: str = "",
    audience_locations: list[str] | None = None,
    product_category: str = "",
) -> str | None:
    t0 = time.perf_counter()
    try:
        prompt = build_image_prompt(
            description=desc, slot_name=slot_name,
            brand_context=brand_context, website=website,
            variation_index=variation_idx,
            image_style=image_style,
            image_mood=image_mood,
            brand_colors=brand_colors,
            aspect_ratio=aspect_ratio,
            audience_age_min=audience_age_min,
            audience_age_max=audience_age_max,
            audience_gender=audience_gender,
            audience_locations=audience_locations,
            product_category=product_category,
        )
        result = await _get_gateway().generate(
            ImageGenParams(prompt=prompt, size=ratio_to_size(aspect_ratio)),
        )
        gen_time = time.perf_counter() - t0

        # Crop to exact target ratio (e.g. 1.91:1 from 3:2) before upload
        final_bytes = _crop_to_ratio(result.image_bytes, aspect_ratio)

        t1 = time.perf_counter()
        cdn_url = await _get_gcs().upload(final_bytes, org_id=org_id)
        upload_time = time.perf_counter() - t1

        logger.info("[build] image: slot=%s gen=%.1fs upload=%.1fs size=%dKB", slot_name, gen_time, upload_time, len(result.image_bytes) // 1024)
        return cdn_url
    except Exception as exc:
        logger.warning("[build] image failed: slot=%s (%.1fs) %s", slot_name, time.perf_counter() - t0, exc)
        return None


async def _build_one_campaign(
    idx: int, campaign: V2CampaignConfig, website: WebsiteContent, org_id: str,
    on_text_done: Any = None, on_images_done: Any = None, on_keywords_done: Any = None,
    creative: "CreativePreferences | None" = None,
    landing_url_override: str = "",
) -> BuiltCampaignAssets:
    """Build text + images for ONE campaign in parallel."""
    ac = campaign.ad_context
    landing_url = landing_url_override or (ac.landing_url if ac else website.url)
    t0_all = time.perf_counter()

    # ── Text asset (v2 pattern: serialized config + system prompt) ──
    async def gen_text() -> dict:
        schema = TEMPLATE_TEXT_ASSET_MAP.get(campaign.template_type)
        if not schema:
            return {"error": f"No schema for {campaign.template_type}"}

        serialized_config = campaign.model_dump_json(indent=2)
        system_prompt = _TEXT_SYSTEM_PROMPT.format(landing_url=landing_url)
        if creative:
            if creative.ad_tone:
                system_prompt += f"\nTONE: Write all copy in a '{creative.ad_tone}' tone."
            if creative.preferred_cta:
                system_prompt += f"\nIMPORTANT: Use '{creative.preferred_cta}' as the call-to-action where applicable."
            if creative.messaging_pillars:
                system_prompt += f"\nEmphasize these themes in all copy: {', '.join(creative.messaging_pillars)}."
            if creative.avoid_themes:
                system_prompt += f"\nDO NOT reference or allude to: {', '.join(creative.avoid_themes)}."

        logger.info("[build] text[%d] START %s %s", idx, campaign.name[:40], schema.__name__)
        t0 = time.perf_counter()
        result = await structured_llm_call(
            serialized_config, schema,
            system_prompt=system_prompt,
            max_retries=2,
            model=settings.workflow_build_model,
        )
        if landing_url:
            result.finalUrl = landing_url
        logger.info("[build] text[%d] OK (%.1fs)", idx, time.perf_counter() - t0)
        return result.model_dump()

    # ── Images (all slots in one gather, 2 per slot, search skips) ──
    async def gen_images() -> Dict[str, list]:
        slots = TEMPLATE_IMAGE_SLOTS.get(campaign.template_type, [])
        if not slots:
            return {}  # search campaigns — no images

        brand_ctx = f"{ac.brand_name} — {ac.tone_of_voice}" if ac else ""
        images_per_slot = 2
        tasks = []
        slot_keys = []  # parallel index → slot_name

        # Extract audience targeting from ad_context for contextual image generation
        audience = ac.audience if ac else None
        img_age_min, img_age_max = 18, 35
        img_gender = ""
        img_locations: list[str] = []
        img_product_category = ""
        if audience:
            from src.agentic_platform.app.common.creative_context import parse_age_range
            img_age_min, img_age_max = parse_age_range(audience.age_range or "")
            img_gender = audience.gender or ""
            if audience.location:
                img_locations = [audience.location]
        if ac and ac.products:
            img_product_category = ac.products[0].category or ""

        for slot_name, aspect_ratio, max_count in slots:
            effective_count = min(images_per_slot, max_count)
            for vi in range(effective_count):
                desc = f"{campaign.name} — {campaign.key_message}"
                if ac and ac.products:
                    desc = f"{ac.products[0].name} — {campaign.key_message}"
                tasks.append(_gen_image(
                    desc, slot_name, aspect_ratio, vi, brand_ctx, website, org_id,
                    image_style=creative.image_style if creative else "",
                    image_mood=creative.image_mood if creative else "",
                    brand_colors=creative.brand_colors if creative else None,
                    audience_age_min=img_age_min,
                    audience_age_max=img_age_max,
                    audience_gender=img_gender,
                    audience_locations=img_locations,
                    product_category=img_product_category,
                ))
                slot_keys.append(slot_name)

        if not tasks:
            return {}

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Group by slot
        slot_urls: Dict[str, list] = {}
        for i, result in enumerate(results):
            if isinstance(result, Exception) or result is None:
                continue
            slot_urls.setdefault(slot_keys[i], []).append(result)
        return slot_urls

    # ── Keywords for Search campaigns (runs in parallel with text + images) ──
    is_search = campaign.campaign_type in (CampaignTypeEnum.SEARCH, "SEARCH")

    async def gen_keywords() -> list:
        if not is_search:
            return []
        ac = campaign.ad_context
        seeds = list(ac.audience.search_queries) if ac and ac.audience and ac.audience.search_queries else []
        result = await generate_keywords(
            campaign.model_dump_json(indent=2),
            seed_keywords=seeds or None,
            messaging_pillars=creative.messaging_pillars if creative and creative.messaging_pillars else None,
            avoid_themes=creative.avoid_themes if creative and creative.avoid_themes else None,
        )
        kws = [kw.model_dump() for kw in result.keywords]
        if on_keywords_done:
            on_keywords_done(len(kws))
        return kws

    # ── Run text + images + keywords in parallel ──
    async def gen_text_tracked() -> dict:
        result = await gen_text()
        if on_text_done:
            on_text_done()
        return result

    async def gen_images_tracked() -> Dict[str, list]:
        result = await gen_images()
        img_count = sum(len(v) for v in result.values()) if isinstance(result, dict) else 0
        if on_images_done:
            on_images_done(img_count)
        return result

    text_result, image_urls, kw_result = await asyncio.gather(
        gen_text_tracked(),
        gen_images_tracked(),
        gen_keywords(),
        return_exceptions=True,
    )

    # Handle exceptions
    if isinstance(text_result, Exception):
        logger.error("[build] campaign[%d] text FAILED: %s", idx, text_result)
        text_result = {}
        if on_text_done:
            on_text_done()
    if isinstance(image_urls, Exception):
        logger.error("[build] campaign[%d] images FAILED: %s", idx, image_urls)
        image_urls = {}
        if on_images_done:
            on_images_done(0)
    if isinstance(kw_result, Exception):
        logger.error("[build] campaign[%d] keywords FAILED: %s", idx, kw_result, exc_info=kw_result)
        kw_result = []

    kw_count = len(kw_result) if isinstance(kw_result, list) else 0
    logger.info("[build] campaign[%d] DONE (%.1fs) text=%d images=%d keywords=%d",
                idx, time.perf_counter() - t0_all,
                len(text_result) if isinstance(text_result, dict) else 0,
                sum(len(v) for v in image_urls.values()) if isinstance(image_urls, dict) else 0,
                kw_count)

    return BuiltCampaignAssets(
        campaign=campaign.model_dump(),
        text_assets=text_result if isinstance(text_result, dict) else {},
        image_urls=image_urls if isinstance(image_urls, dict) else {},
        keywords=kw_result if isinstance(kw_result, list) else [],
    )


async def build(ctx: WorkflowContext) -> NodeResponse:
    """Build campaigns + create media plan in parallel (v2 pattern)."""
    logger.info("[build] START")
    plan_result = ctx.results.get("plan")
    scrape_result = ctx.results.get("scrape")
    if not plan_result or not plan_result.data:
        return NodeResponse(summary="No plan data", data={})

    campaign_plan = V2CampaignPlan(**{k: v for k, v in plan_result.data.items() if not k.startswith("_")})
    website = WebsiteContent(**scrape_result.data) if scrape_result and scrape_result.data else WebsiteContent(url="")
    url = ctx.args.get("url", "")

    # Creative preferences from user
    args = CreateCampaignArgs.from_ctx_args(ctx.args)
    creative = args.creative
    products_prefs = args.products

    # Recover CampaignContext from plan step data (survives HITL checkpoint)
    campaign_ctx = CampaignContext.from_step_data(plan_result.data)
    if not campaign_ctx:
        campaign_ctx = CampaignContext(
            org_id=plan_result.data.get("_org_id") or ctx.org_id,
            user_id=plan_result.data.get("_user_id") or ctx.user_id,
        )
    org_id = campaign_ctx.org_id
    user_id = campaign_ctx.user_id
    g_account_id = campaign_ctx.get_account_id("GOOGLE")
    b_account_id = campaign_ctx.get_account_id("BING")
    logger.info("[build] account IDs: google=%s bing=%s", g_account_id, b_account_id)

    ctx.progress.start("text")
    ctx.progress.start("images")
    ctx.progress.start("keywords")
    ctx.progress.start("logos")

    # ── Logo (shared across campaigns) ──
    async def fetch_logo() -> str | None:
        fav = website.metadata.favicon_url
        if not fav:
            return None
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
                resp = await client.get(fav, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code != 200 or not resp.content:
                    return None
                ct = resp.headers.get("content-type", "").split(";")[0].strip()
                if ct in _REJECTED_CT:
                    return None
                return await _get_gcs().upload(resp.content, org_id=org_id, asset_type="logos")
        except Exception:
            return None

    # ── Create media plan in parallel with campaign building (v2 pattern) ──
    async def create_media_plan_async() -> dict:
        try:
            mp = await campaign_client.create_media_plan(
                name=campaign_plan.plan_name, url=url, org_id=org_id, user_id=user_id,
                google_account_id=g_account_id, bing_account_id=b_account_id,
            )
            logger.info("[build] media plan created: %s", mp.get("id", "unknown"))
            return mp
        except Exception as exc:
            logger.error("[build] media plan creation failed: %s", exc)
            return {"error": str(exc)}

    # ── ALL campaigns + logo + media plan in ONE gather ──
    logger.info("[build] launching %d campaigns + logo + media plan in parallel", len(campaign_plan.campaigns))
    t0 = time.perf_counter()

    async def build_campaigns_with_progress() -> list:
        total = len(campaign_plan.campaigns)
        text_done = [0]
        img_total = [0]
        kw_total = [0]

        search_count = sum(1 for c in campaign_plan.campaigns
                           if c.campaign_type in (CampaignTypeEnum.SEARCH, "SEARCH"))
        image_count = total - search_count
        img_done = [0]
        kw_done = [0]

        if image_count == 0:
            ctx.progress.done("images", summary="n/a")
        if search_count == 0:
            ctx.progress.done("keywords", summary="n/a")

        def on_text():
            text_done[0] += 1
            if text_done[0] >= total:
                ctx.progress.done("text", summary=f"{total} campaigns")
            else:
                ctx.progress.update("text", message=f"{text_done[0]}/{total} campaigns done")

        def on_images(count: int):
            img_total[0] += count
            img_done[0] += 1
            if img_done[0] >= total and image_count > 0:
                ctx.progress.done("images", summary=f"{img_total[0]} images")
            elif img_total[0] > 0:
                ctx.progress.update("images", message=f"{img_total[0]} images generated")

        def on_keywords(count: int):
            kw_total[0] += count
            kw_done[0] += 1
            if kw_done[0] >= search_count and search_count > 0:
                ctx.progress.done("keywords", summary=f"{kw_total[0]} keywords")
            elif kw_total[0] > 0:
                ctx.progress.update("keywords", message=f"{kw_total[0]} keywords generated")

        results = await asyncio.gather(
            *[_build_one_campaign(
                i, c, website, org_id,
                on_text_done=on_text, on_images_done=on_images, on_keywords_done=on_keywords,
                creative=creative,
                landing_url_override=products_prefs.landing_url if products_prefs else "",
              )
              for i, c in enumerate(campaign_plan.campaigns)],
            return_exceptions=True,
        )

        if text_done[0] < total:
            ctx.progress.done("text", summary=f"{text_done[0]} campaigns")
        if image_count > 0 and img_done[0] < total:
            ctx.progress.done("images", summary=f"{img_total[0]} images" if img_total[0] else "n/a")
        if search_count > 0 and kw_done[0] < search_count:
            ctx.progress.done("keywords", summary=f"{kw_total[0]} keywords" if kw_total[0] else "n/a")

        return results

    async def fetch_logo_with_progress() -> str | None:
        result = await fetch_logo()
        ctx.progress.done("logos", summary="OK" if result else "none")
        return result

    campaign_results, logo_url, media_plan_result = await asyncio.gather(
        build_campaigns_with_progress(),
        fetch_logo_with_progress(),
        create_media_plan_async(),
        return_exceptions=True,
    )

    if isinstance(campaign_results, Exception):
        logger.error("[build] campaigns gather FAILED: %s", campaign_results)
        campaign_results = []
    if isinstance(logo_url, Exception):
        logo_url = None
    if isinstance(media_plan_result, Exception):
        logger.error("[build] media plan FAILED: %s", media_plan_result)
        media_plan_result = {"error": str(media_plan_result)}

    logger.info("[build] all done (%.1fs)", time.perf_counter() - t0)

    campaigns_built: list[BuiltCampaignAssets] = []
    for result in campaign_results:
        if isinstance(result, Exception):
            logger.error("[build] campaign FAILED: %s", result)
            continue
        result.logo_url = logo_url
        campaigns_built.append(result)

    ok_imgs = sum(len(urls) for r in campaigns_built for urls in r.image_urls.values())
    logger.info("[build] DONE: %d campaigns, %d images", len(campaigns_built), ok_imgs)

    total_text = sum(len(r.text_assets) for r in campaigns_built)
    ctx.emit_artifact(StepArtifact(
        type="build_summary",
        title="Assets",
        data={
            "campaign_count": len(campaigns_built),
            "total_images": ok_imgs,
            "total_text_assets": total_text,
            "logo_found": logo_url is not None,
        },
    ))

    step_data = BuildStepData(
        campaigns=campaigns_built,
        plan=campaign_plan.model_dump(),
        campaign_context=campaign_ctx,
        org_id=org_id,
        user_id=user_id,
        media_plan=media_plan_result if isinstance(media_plan_result, dict) else {},
    )

    return NodeResponse(
        summary=f"Built {len(campaigns_built)} campaigns",
        data=step_data.to_node_data(),
    )

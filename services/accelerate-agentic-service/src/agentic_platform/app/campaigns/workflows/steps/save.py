"""Step 6: Save — persist campaigns to platform via API."""

import logging
import uuid

from src.agentic_platform.core.engine.models import NodeResponse
from src.agentic_platform.core.engine.workflow import WorkflowContext
from src.agentic_platform.app.campaigns.models import (
    V2CampaignConfig, V2CampaignPlan,
    CampaignRequest, BudgetRequest, BudgetType, AssetGroupRequest, AdGroupRequest,
    AdRequest, CampaignTargetingType, CampaignTargetingRequest,
    AdGroupTargetingType, AdGroupTargetingRequest,
    PlatformType, CampaignType as CampaignTypeEnum,
    BuildStepData,
)
from src.agentic_platform.app.campaigns.targeting import resolve_all_targeting, TargetingCriterion
from src.agentic_platform.app.campaigns.services import campaign_client

logger = logging.getLogger(__name__)

_PREFIX = "Accelerate"


def _uid():
    return uuid.uuid4().hex[:6]


def _build_slot_data(text: dict, images: dict, logo: str | None, tmpl: str) -> dict:
    sd: dict[str, list[str]] = {}
    for k, v in text.items():
        if v is None:
            continue
        sd[k] = [str(x) for x in v if x is not None] if isinstance(v, list) else [str(v)]
    for slot, urls in images.items():
        if urls:
            sd[slot] = [str(u) for u in urls if u]
    if logo:
        if "PERFORMANCE_MAX" in tmpl:
            sd.setdefault("logos", []).append(logo)
        elif "DISPLAY" in tmpl:
            sd.setdefault("squareLogos", []).append(logo)
    return sd


def _build_targeting(criteria, TargetingType, RequestModel):
    if not criteria:
        return None
    result = {}
    for t in criteria:
        key = TargetingType(t.type)
        req = RequestModel(criterionId=t.criterion_id, name=t.name, isNegative=t.is_negative)
        if t.type == "KEYWORD":
            req.matchType = t.match_type or "BROAD"
            req.text = t.name
        result.setdefault(key, []).append(req)
    return result or None


async def save(ctx: WorkflowContext) -> NodeResponse:
    logger.info("[save] START")
    build_result = ctx.results.get("build")
    if not build_result or not build_result.data:
        return NodeResponse(summary="No build data", data={})

    build_data = BuildStepData.from_node_data(build_result.data)
    campaign_plan = V2CampaignPlan(**build_data.plan)
    url = ctx.args.get("url", "")

    campaign_ctx = build_data.campaign_context
    org_id = campaign_ctx.org_id if campaign_ctx else build_data.org_id or ctx.org_id
    user_id = campaign_ctx.user_id if campaign_ctx else build_data.user_id or ctx.user_id
    g_id = campaign_ctx.get_account_id("GOOGLE") if campaign_ctx else ""
    b_id = campaign_ctx.get_account_id("BING") if campaign_ctx else ""

    # Media plan was created in parallel during build step
    mp = build_data.media_plan
    if "error" in mp or "id" not in mp:
        # Retry if build-step creation failed
        try:
            mp = await campaign_client.create_media_plan(
                name=campaign_plan.plan_name, url=url, org_id=org_id, user_id=user_id,
                google_account_id=g_id, bing_account_id=b_id,
            )
        except Exception as exc:
            logger.warning("[save] media plan creation failed (non-fatal): %s", exc)
            mp = {}  # Continue — campaigns were generated; save failure is non-critical
    plan_id = mp.get("id") or mp.get("data", {}).get("id")

    requests = []
    campaign_blocks: list[dict] = []
    for i, built in enumerate(build_data.campaigns):
        c = V2CampaignConfig(**built.campaign)
        s = _uid()

        # Targeting from audience data
        ac = c.ad_context
        aud = ac.audience if ac else None
        targeting_dict = {
            "template_type": c.template_type,
            "target_countries": [l.strip() for l in aud.location.split(",") if l.strip()] if aud else [],
            "target_languages": [aud.language] if aud and aud.language else ["English"],
            "target_age_ranges": [aud.age_range] if aud and aud.age_range else [],
            "target_genders": [aud.gender] if aud and aud.gender != "ALL" else [],
            "keywords": list(aud.search_queries) if aud else [],
        }
        ct_list, ag_list = resolve_all_targeting(targeting_dict, c.platform)

        # For Search campaigns: use LLM-generated keywords from build step
        if built.keywords:
            ag_list = [t for t in ag_list if t.type != "KEYWORD"]
            for kw in built.keywords:
                text = kw.get("text", "").strip()
                if not text:
                    continue
                ag_list.append(TargetingCriterion(
                    criterion_id="", name=text, type="KEYWORD",
                    is_negative=kw.get("is_negative", False),
                    match_type=kw.get("match_type", "BROAD"),
                ))

        slot_data = _build_slot_data(built.text_assets, built.image_urls, built.logo_url, c.template_type)
        budget = BudgetRequest(name=f"{_PREFIX} - {c.name}_budget_{s}", amount=c.daily_budget,
                               currency=c.budget_currency, budgetType=BudgetType.DAILY)

        camp_tgt = _build_targeting(ct_list, CampaignTargetingType, CampaignTargetingRequest)
        ag_tgt = _build_targeting(ag_list, AdGroupTargetingType, AdGroupTargetingRequest)

        is_pmax = c.campaign_type == CampaignTypeEnum.PERFORMANCE_MAX
        if is_pmax:
            asset_groups = [AssetGroupRequest(name=f"{_PREFIX} - {c.name}_ag_{s}",
                                              templateType=c.template_type, slotData=slot_data)]
            ad_groups = None
        else:
            ad = AdRequest(name=f"{_PREFIX} - {c.name}_ad_{s}", templateType=c.template_type, slotData=slot_data)
            ad_groups = [AdGroupRequest(name=f"{_PREFIX} - {c.name}_adg_{s}", ads=[ad], targeting=ag_tgt)]
            asset_groups = None

        requests.append(CampaignRequest(
            name=f"{_PREFIX} - {c.name}_{s}", platformType=PlatformType(c.platform),
            campaignType=CampaignTypeEnum(c.campaign_type), startDate=c.start_date or None,
            endDate=c.end_date or None, budget=budget, adGroups=ad_groups,
            assetGroups=asset_groups, targeting=camp_tgt,
        ))

        # Collect rich block data (targeting + creatives) for the RHS preview panel
        kws = [
            kw.get("text", "").strip()
            for kw in (built.keywords or [])
            if not kw.get("is_negative", False) and kw.get("text", "").strip()
        ] or targeting_dict.get("keywords", [])[:30]
        neg_kws = [
            kw.get("text", "").strip()
            for kw in (built.keywords or [])
            if kw.get("is_negative", False) and kw.get("text", "").strip()
        ]
        bn = slot_data.get("businessName", "")
        # longHeadline is singular in all schemas; guard against both forms
        long_h = slot_data.get("longHeadline", slot_data.get("longHeadlines", []))
        if isinstance(long_h, str):
            long_h = [long_h]
        # Image slots vary by platform/template:
        # Google/Bing: marketingImages, squareMarketingImages, portraitMarketingImages
        # Bing Display: images, squareImages
        # Meta: marketingImages, squareMarketingImages, storyImages, carouselImages, coverImage
        all_images = (
            slot_data.get("marketingImages", [])
            + slot_data.get("squareMarketingImages", [])
            + slot_data.get("portraitMarketingImages", [])
            + slot_data.get("storyImages", [])
            + slot_data.get("carouselImages", [])
            + slot_data.get("coverImage", [])
            + slot_data.get("images", [])
            + slot_data.get("squareImages", [])
        )
        # Headlines: Google uses "headlines" (list), Meta uses "headline" (str)
        headlines = (
            slot_data.get("headlines", [])[:15]
            or ([slot_data["headline"]] if slot_data.get("headline") else [])
        )
        # Descriptions: Google uses "descriptions" (list), Meta uses "description"/"message"
        descriptions = (
            slot_data.get("descriptions", [])[:4]
            or ([slot_data["description"]] if slot_data.get("description") else [])
            or ([slot_data["message"]] if slot_data.get("message") else [])
        )
        cta_raw = slot_data.get("callToAction", "")
        cta = (cta_raw[0] if isinstance(cta_raw, list) else cta_raw) or ""
        campaign_blocks.append({
            "name": c.name,
            "platform": c.platform,
            "campaign_type": c.campaign_type,
            "daily_budget": c.daily_budget,
            "currency": c.budget_currency,
            "targeting": {
                "locations": targeting_dict.get("target_countries", []),
                "languages": targeting_dict.get("target_languages", []),
                "age_ranges": [a for a in targeting_dict.get("target_age_ranges", []) if a],
                "genders": [g for g in targeting_dict.get("target_genders", []) if g],
                "keywords": kws[:30],
                "negative_keywords": neg_kws[:20],
            },
            "creatives": {
                "headlines": headlines,
                "descriptions": descriptions,
                "long_headlines": long_h[:5],
                "images": all_images[:5],
                "business_name": (bn[0] if isinstance(bn, list) else bn) or "",
                "call_to_action": cta,
                # Meta-specific body copy preserved separately for rich preview
                "primary_text": slot_data.get("message", ""),
            },
        })

    dicts = [r.model_dump(mode="json", exclude_none=True) for r in requests]

    saved_to_dashboard = False
    if plan_id:
        try:
            await campaign_client.create_campaigns(
                media_plan_id=plan_id, campaigns=dicts, org_id=org_id,
                user_id=user_id, google_account_id=g_id, bing_account_id=b_id,
            )
            saved_to_dashboard = True
        except Exception as exc:
            logger.warning("[save] campaign detail save failed (non-fatal): %s", exc)

    logger.info("[save] DONE: %d campaigns, saved=%s, plan=%s", len(requests), saved_to_dashboard, plan_id)
    summary = f"Built {len(requests)} campaigns" + (f" → plan {plan_id}" if plan_id else " (ready to publish)")
    return NodeResponse(
        summary=summary,
        data={"plan_id": plan_id, "count": len(requests)},
        ui_blocks=[{
            "type": "media_plan",
            "display": "sidebar",
            "data": {
                "plan_id": plan_id,
                "plan_name": campaign_plan.plan_name,
                "url": url,
                "campaign_count": len(requests),
                "platforms": sorted({r.platformType.value for r in requests}),
                "total_daily_budget": sum(r.budget.amount for r in requests),
                "currency": requests[0].budget.currency if requests else "USD",
                "currency_totals": {
                    cur: sum(r.budget.amount for r in requests if r.budget.currency == cur)
                    for cur in {r.budget.currency for r in requests}
                },
                "campaigns": campaign_blocks,
                # Audience summary for inline card header
                "audience_summary": {
                    "age_ranges": sorted({
                        a for b in campaign_blocks for a in b.get("targeting", {}).get("age_ranges", []) if a
                    }),
                    "locations": sorted({
                        loc for b in campaign_blocks for loc in b.get("targeting", {}).get("locations", []) if loc
                    })[:6],
                },
            },
        }],
    )

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
            logger.error("[save] media plan failed: %s", exc)
            return NodeResponse(summary=f"Media plan failed: {exc}", data={})
    plan_id = mp.get("id", "unknown")

    requests = []
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

    dicts = [r.model_dump(mode="json", exclude_none=True) for r in requests]

    try:
        await campaign_client.create_campaigns(
            media_plan_id=plan_id, campaigns=dicts, org_id=org_id,
            user_id=user_id, google_account_id=g_id, bing_account_id=b_id,
        )
    except Exception as exc:
        logger.error("[save] campaign save failed: %s", exc)
        return NodeResponse(summary=f"Plan {plan_id} created but save failed: {exc}", data={"plan_id": plan_id})

    logger.info("[save] DONE: %d campaigns → plan %s", len(requests), plan_id)
    return NodeResponse(
        summary=f"Saved {len(requests)} campaigns to plan {plan_id}",
        data={"plan_id": plan_id, "count": len(requests)},
        ui_blocks=[{
            "type": "media_plan",
            "display": "sidebar",
            "data": {
                "plan_id": plan_id,
                "plan_name": campaign_plan.plan_name,
                "campaign_count": len(requests),
                "platforms": sorted({r.platformType.value for r in requests}),
                "total_daily_budget": sum(r.budget.amount for r in requests),
                "currency": requests[0].budget.currency if requests else "USD",
                "currency_totals": {
                    cur: sum(r.budget.amount for r in requests if r.budget.currency == cur)
                    for cur in {r.budget.currency for r in requests}
                },
            },
        }],
    )

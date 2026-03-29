"""Platform tools — 8 tools that call connector-service and shopping-feeds-service."""

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.app.accelera.services.clients import (
    connector_client, shopping_feeds_client, reporting_client, commerce_client, campaigns_client,
)
from src.agentic_platform.app.accelera.models.platform import PLATFORM_STRATEGIES
from src.agentic_platform.app.accelera.blocks import (
    metric_cards_block, MetricCardsData, MetricItem,
    feed_health_block, FeedHealthData, FeedIssueRow,
    connect_prompt_block, ConnectPromptData,
    nav_suggestion_block, NavSuggestionData,
)


# ── get_connected_platforms ───────────────────────────────────────────

@tool("get_connected_platforms")
async def _get_connected_platforms() -> dict:
    """List all connected ad accounts: Meta, Google, and Bing with their status.
    Use when the user asks which platforms are connected or wants to see their ad accounts."""
    org_id = get_org_id()
    resp = await connector_client.get(f"/connectors/all/accounts?org_id={org_id}")
    body = resp.get("body", {})
    accounts = body.get("accounts") or (body if isinstance(body, list) else [])

    if not accounts:
        return ToolResponse(
            summary="No ad platforms connected yet.",
            data={"accounts": []},
            ui_blocks=[connect_prompt_block.create(data=ConnectPromptData(
                platform="meta", reason="Connect your ad accounts to start tracking performance."
            ))],
        ).model_dump()

    metrics = [
        MetricItem(
            label=a.get("platform", "").capitalize(),
            value=a.get("accountName") or a.get("account_name", ""),
            trend="up" if a.get("status") == "connected" else "down",
        )
        for a in accounts
    ]

    return ToolResponse(
        summary=f"{len(accounts)} ad platform(s) connected: {', '.join(a.get('platform','') for a in accounts)}.",
        data={"accounts": accounts},
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Connected Ad Platforms"))],
    ).model_dump()

get_connected_platforms = AgenticTool(func=_get_connected_platforms, thinking_messages=["Checking connected ad platforms..."], tags=[ToolTag.ANALYTICS])


# ── get_ad_platform_status ────────────────────────────────────────────

@tool("get_ad_platform_status")
async def _get_ad_platform_status() -> dict:
    """Get health and connection status of all ad platforms.
    Use when the user asks if their platforms are working, connected, or syncing properly."""
    org_id = get_org_id()
    resp = await connector_client.get(f"/connectors/all/accounts?org_id={org_id}")
    body = resp.get("body", {})
    accounts = body.get("accounts") or (body if isinstance(body, list) else [])

    statuses = []
    for a in accounts:
        status = a.get("status", "unknown")
        synced = a.get("lastSynced") or a.get("last_synced", "Never")
        statuses.append(MetricItem(
            label=f"{a.get('platform','').capitalize()} — {a.get('accountName','')}",
            value=status.capitalize(),
            change=f"Synced: {synced}",
        ))

    if not statuses:
        statuses = [MetricItem(label="Status", value="No platforms connected")]

    return ToolResponse(
        summary=f"Platform status: {len(accounts)} accounts checked.",
        data={"accounts": accounts},
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=statuses, title="Ad Platform Status"))],
    ).model_dump()

get_ad_platform_status = AgenticTool(func=_get_ad_platform_status, thinking_messages=["Checking platform health..."], tags=[ToolTag.ANALYTICS])


# ── get_feed_health ───────────────────────────────────────────────────

@tool("get_feed_health")
async def _get_feed_health() -> dict:
    """Check product feed health: score, sync status, and any issues.
    Use when the user asks about their shopping feed, Google Merchant Center feed, or product feed status."""
    org_id = get_org_id()
    resp = await shopping_feeds_client.get(f"/shopping-feeds/health?org_id={org_id}")
    body = resp.get("body", {})

    score = body.get("score", 0.0)
    status = "healthy" if score >= 80 else ("degraded" if score >= 50 else "error")
    issues_raw = body.get("issues", [])
    issues = [FeedIssueRow(severity=i.get("severity","info"), message=i.get("message",""), affected_products=i.get("affectedProducts",0)) for i in issues_raw]

    return ToolResponse(
        summary=f"Feed health score: {score:.0f}/100 ({status}). {len(issues)} issues found.",
        data=body,
        ui_blocks=[feed_health_block.create(data=FeedHealthData(
            score=score, status=status,
            total_products=body.get("totalProducts", 0),
            synced_products=body.get("syncedProducts", 0),
            issues=issues,
            last_synced=body.get("lastSynced"),
        ))],
    ).model_dump()

get_feed_health = AgenticTool(func=_get_feed_health, thinking_messages=["Checking your product feed health..."], tags=[ToolTag.ANALYTICS])


# ── generate_product_feed ─────────────────────────────────────────────

@tool("generate_product_feed")
async def _generate_product_feed(market: str = "US") -> dict:
    """Trigger a product feed sync and generate an optimized feed snapshot.
    Use when the user asks to sync their product feed or refresh it."""
    org_id = get_org_id()
    resp = await shopping_feeds_client.post("/shopping-feeds/sync", json={"org_id": org_id, "market": market})
    body = resp.get("body", {})
    status = body.get("status", "queued")
    count = body.get("product_count") or body.get("productCount", 0)

    return ToolResponse(
        summary=f"Feed sync {status}. {count} products queued for {market} market.",
        data=body,
    ).model_dump()

generate_product_feed = AgenticTool(func=_generate_product_feed, thinking_messages=["Generating product feed..."], tags=[ToolTag.ANALYTICS])


# ── get_merchant_center_status ────────────────────────────────────────

@tool("get_merchant_center_status")
async def _get_merchant_center_status() -> dict:
    """Check Google Merchant Center connection and product approval status.
    Use when the user asks about Google Shopping, Merchant Center, or product approvals."""
    org_id = get_org_id()
    resp = await shopping_feeds_client.get(f"/shopping-feeds/merchants?org_id={org_id}")
    body = resp.get("body", {})

    connected = body.get("connected", False)
    approved = body.get("approvedProducts") or body.get("approved_products", 0)
    pending = body.get("pendingProducts") or body.get("pending_products", 0)
    disapproved = body.get("disapprovedProducts") or body.get("disapproved_products", 0)

    metrics = [
        MetricItem(label="Status", value="Connected" if connected else "Not Connected"),
        MetricItem(label="Approved", value=str(approved), trend="up"),
        MetricItem(label="Pending", value=str(pending)),
        MetricItem(label="Disapproved", value=str(disapproved), trend="down" if disapproved > 0 else "neutral"),
    ]

    return ToolResponse(
        summary=f"Merchant Center: {'connected' if connected else 'not connected'}. {approved} approved, {disapproved} disapproved products.",
        data=body,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Google Merchant Center"))],
    ).model_dump()

get_merchant_center_status = AgenticTool(func=_get_merchant_center_status, thinking_messages=["Checking Google Merchant Center..."], tags=[ToolTag.ANALYTICS])


# ── suggest_campaign_strategy ─────────────────────────────────────────

@tool("suggest_campaign_strategy")
async def _suggest_campaign_strategy() -> dict:
    """Recommend a multi-campaign strategy based on your current ad performance and product catalog.
    Use when the user asks what campaigns to run or wants a strategy recommendation."""
    org_id = get_org_id()
    import asyncio
    report_resp, products_resp = await asyncio.gather(
        reporting_client.post("/report", json={"orgId": org_id, "days": 30, "by_platform": True}),
        commerce_client.get(f"/products/suggestions?org_id={org_id}&limit=5"),
    )

    report = report_resp.get("body", {})
    products = products_resp.get("body", {})
    top_products = products.get("products", [])[:3] if isinstance(products, dict) else []

    platforms_data = report.get("platforms") or report.get("byPlatform", [])
    active_platforms = [p.get("platform", "") for p in platforms_data if p.get("spend", 0) > 0]

    strategy_lines = []
    if not active_platforms:
        strategy_lines.append("Start with Meta Feed ads for product discovery — lowest barrier to entry.")
        strategy_lines.append("Add Google Shopping once you have product feed set up.")
    else:
        for platform in active_platforms:
            strats = PLATFORM_STRATEGIES.get(platform, [])
            if strats:
                strategy_lines.append(f"{platform.capitalize()}: Consider adding {strats[0].name} campaigns.")

    if top_products:
        strategy_lines.append(f"Top products to feature: {', '.join(p.get('title','') for p in top_products[:3])}.")

    metrics = [MetricItem(label=f"Tip {i+1}", value=line[:50]) for i, line in enumerate(strategy_lines[:4])]

    return ToolResponse(
        summary=f"Strategy: {len(strategy_lines)} recommendations based on your current setup.",
        data={"recommendations": strategy_lines, "active_platforms": active_platforms},
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Campaign Strategy Recommendations"))],
    ).model_dump()

suggest_campaign_strategy = AgenticTool(func=_suggest_campaign_strategy, thinking_messages=["Building your campaign strategy..."], tags=[ToolTag.ANALYTICS])


# ── get_campaign_strategies ───────────────────────────────────────────

@tool("get_campaign_strategies")
async def _get_campaign_strategies(platform: str = "all") -> dict:
    """List available campaign types and ad formats for each platform.
    Use when the user asks what campaign types are available or wants to know their options."""
    if platform == "all":
        strategies = {p: [s.model_dump() for s in strats] for p, strats in PLATFORM_STRATEGIES.items()}
    else:
        strats = PLATFORM_STRATEGIES.get(platform.lower(), [])
        strategies = {platform: [s.model_dump() for s in strats]}

    total = sum(len(v) for v in strategies.values())
    metrics = [
        MetricItem(label=p.capitalize(), value=f"{len(strats)} ad types")
        for p, strats in strategies.items()
    ]

    return ToolResponse(
        summary=f"{total} campaign types available across {len(strategies)} platforms.",
        data={"strategies": strategies},
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Available Campaign Types"))],
    ).model_dump()

get_campaign_strategies = AgenticTool(func=_get_campaign_strategies, thinking_messages=["Loading available campaign types..."], tags=[ToolTag.ANALYTICS])


# ── growth_opportunities ──────────────────────────────────────────────

@tool("growth_opportunities")
async def _growth_opportunities() -> dict:
    """Identify untapped growth opportunities: uncovered products, lookalike gaps, new platforms.
    Use when the user asks how to grow or scale their advertising."""
    org_id = get_org_id()
    import asyncio
    products_resp, campaigns_resp, platforms_resp = await asyncio.gather(
        commerce_client.get(f"/products/suggestions?org_id={org_id}&limit=20"),
        campaigns_client.get(f"/campaigns?org_id={org_id}&limit=50"),
        connector_client.get(f"/connectors/all/accounts?org_id={org_id}"),
    )

    products_body = products_resp.get("body", {})
    all_products = products_body.get("products", []) if isinstance(products_body, dict) else []
    campaigns_body = campaigns_resp.get("body", {})
    active_campaigns = campaigns_body.get("campaigns", []) if isinstance(campaigns_body, dict) else []
    platforms_body = platforms_resp.get("body", {})
    connected_accounts = platforms_body.get("accounts", []) if isinstance(platforms_body, dict) else []

    # Products not in any campaign
    campaigned_products = {c.get("productId") or c.get("product_id", "") for c in active_campaigns}
    uncovered = [p for p in all_products if p.get("id") not in campaigned_products]

    # Platforms not yet used
    connected_platforms = {a.get("platform", "").lower() for a in connected_accounts}
    all_platforms = {"meta", "google", "bing"}
    unused_platforms = all_platforms - connected_platforms

    opportunities = []
    if uncovered:
        opportunities.append(f"{len(uncovered)} top products have no active campaigns — missed revenue opportunity.")
    if unused_platforms:
        opportunities.append(f"Not on {', '.join(p.capitalize() for p in unused_platforms)} — consider expanding reach.")
    if len(active_campaigns) < 3:
        opportunities.append("Running fewer than 3 campaigns — more campaign variety typically improves ROAS.")

    metrics = [MetricItem(label=f"Opportunity {i+1}", value=opp[:60]) for i, opp in enumerate(opportunities)]

    return ToolResponse(
        summary=f"Found {len(opportunities)} growth opportunities.",
        data={"opportunities": opportunities, "uncovered_products": len(uncovered), "unused_platforms": list(unused_platforms)},
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="Growth Opportunities"))],
    ).model_dump()

growth_opportunities = AgenticTool(func=_growth_opportunities, thinking_messages=["Identifying growth opportunities..."], tags=[ToolTag.ANALYTICS])

"""Ecommerce tools — 6 tools that call commerce-service.

All tools follow the AgenticTool pattern: @tool decorator, AgenticTool wrapper,
ToolResponse return. Data flows: commerce-service → ToolResponse + BlockSpec.
"""

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.app.accelera.services.clients import commerce_client
from src.agentic_platform.app.accelera.blocks import (
    product_leaderboard_block, ProductLeaderboardData, ProductRow,
    metric_cards_block, MetricCardsData, MetricItem,
    inventory_card_block, InventoryCardData, InventoryAlertRow,
)


# ── get_products ──────────────────────────────────────────────────────

@tool("get_products")
async def _get_products(limit: int = 20, sort_by: str = "revenue") -> dict:
    """List products with prices, inventory levels, and 30-day sales velocity.
    Use when the user asks about their product catalog, top sellers, or wants to
    see what products they're selling."""
    org_id = get_org_id()
    resp = await commerce_client.get(f"/products?org_id={org_id}&limit={limit}&sort_by={sort_by}")
    body = resp.get("body", {})
    products = body.get("products", body) if isinstance(body, dict) else body

    rows = [
        ProductRow(
            id=p.get("id", ""),
            title=p.get("title", ""),
            price=p.get("price", 0.0),
            revenue_l30d=p.get("revenueL30d") or p.get("revenue_l30d", 0.0),
            sales_velocity=p.get("salesVelocity") or p.get("sales_velocity", 0.0),
            inventory_qty=p.get("inventoryQty") or p.get("inventory_qty", 0),
            badge=p.get("tag"),
            image_url=p.get("imageUrl") or p.get("image_url"),
        )
        for p in (products if isinstance(products, list) else [])
    ]

    return ToolResponse(
        summary=f"Found {len(rows)} products sorted by {sort_by}.",
        data={"products": [r.model_dump() for r in rows], "total": len(rows)},
        ui_blocks=[product_leaderboard_block.create(data=ProductLeaderboardData(products=rows))],
    ).model_dump()

get_products = AgenticTool(func=_get_products, thinking_messages=["Fetching your product catalog..."], tags=[ToolTag.ANALYTICS])


# ── get_product_suggestions ───────────────────────────────────────────

@tool("get_product_suggestions")
async def _get_product_suggestions(limit: int = 10) -> dict:
    """Get AI-ranked top products to advertise based on 30-day sales velocity and revenue.
    Use when the user asks which products to run ads for or wants product recommendations."""
    org_id = get_org_id()
    resp = await commerce_client.get(f"/products/suggestions?org_id={org_id}&limit={limit}")
    body = resp.get("body", {})
    products = body.get("products", body) if isinstance(body, dict) else body

    rows = [
        ProductRow(
            id=p.get("id", ""),
            title=p.get("title", ""),
            price=p.get("price", 0.0),
            revenue_l30d=p.get("revenueL30d") or p.get("revenue_l30d", 0.0),
            sales_velocity=p.get("salesVelocity") or p.get("sales_velocity", 0.0),
            inventory_qty=p.get("inventoryQty") or p.get("inventory_qty", 0),
            badge="top_seller",
            ai_recommendation=p.get("aiRecommendation") or p.get("ai_recommendation"),
        )
        for p in (products if isinstance(products, list) else [])
    ]

    return ToolResponse(
        summary=f"Top {len(rows)} products recommended for advertising.",
        data={"products": [r.model_dump() for r in rows]},
        ui_blocks=[product_leaderboard_block.create(data=ProductLeaderboardData(
            products=rows, title="Recommended Products to Advertise"
        ))],
    ).model_dump()

get_product_suggestions = AgenticTool(func=_get_product_suggestions, thinking_messages=["Finding your best products to advertise..."], tags=[ToolTag.ANALYTICS])


# ── get_sales ─────────────────────────────────────────────────────────

@tool("get_sales")
async def _get_sales(days: int = 30) -> dict:
    """Get revenue, orders, and average order value for a time period.
    Use when the user asks about sales, revenue, orders, or AOV."""
    org_id = get_org_id()
    resp = await commerce_client.get(f"/revenue/summary?org_id={org_id}&days={days}")
    body = resp.get("body", {})
    if isinstance(body, dict) and "body" in body:
        body = body["body"]

    revenue = body.get("revenue", 0.0)
    orders = body.get("orders", 0)
    aov = body.get("aov", revenue / orders if orders else 0.0)
    currency = body.get("currency", "USD")

    metrics = [
        MetricItem(label="Revenue", value=f"{currency} {revenue:,.2f}", trend="up"),
        MetricItem(label="Orders", value=str(orders)),
        MetricItem(label="AOV", value=f"{currency} {aov:,.2f}"),
        MetricItem(label="New Customers", value=str(body.get("new_customers", 0))),
        MetricItem(label="Repeat Rate", value=f"{body.get('repeat_rate', 0.0):.1f}%"),
    ]

    return ToolResponse(
        summary=f"Last {days} days: {currency} {revenue:,.2f} revenue from {orders} orders. AOV: {currency} {aov:,.2f}.",
        data=body,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, period=f"Last {days} days", currency=currency))],
    ).model_dump()

get_sales = AgenticTool(func=_get_sales, thinking_messages=["Pulling your sales data..."], tags=[ToolTag.ANALYTICS])


# ── get_ecommerce_overview ────────────────────────────────────────────

@tool("get_ecommerce_overview")
async def _get_ecommerce_overview(days: int = 30) -> dict:
    """Get a full e-commerce KPI overview: revenue, orders, AOV, repeat rate, and channel breakdown.
    Use when the user wants a general store performance summary or overview."""
    org_id = get_org_id()
    resp = await commerce_client.get(f"/revenue/summary?org_id={org_id}&days={days}")
    body = resp.get("body", {})

    revenue = body.get("revenue", 0.0)
    orders = body.get("orders", 0)
    aov = body.get("aov", revenue / orders if orders else 0.0)
    repeat_rate = body.get("repeat_rate", 0.0)
    currency = body.get("currency", "USD")

    metrics = [
        MetricItem(label="Total Revenue", value=f"{currency} {revenue:,.2f}"),
        MetricItem(label="Total Orders", value=str(orders)),
        MetricItem(label="Avg Order Value", value=f"{currency} {aov:,.2f}"),
        MetricItem(label="Repeat Rate", value=f"{repeat_rate:.1f}%"),
        MetricItem(label="New Customers", value=str(body.get("new_customers", 0))),
    ]

    return ToolResponse(
        summary=f"E-commerce overview (last {days}d): {currency} {revenue:,.2f} revenue, {orders} orders, {aov:,.2f} AOV.",
        data=body,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title="E-Commerce Overview", period=f"Last {days} days"))],
    ).model_dump()

get_ecommerce_overview = AgenticTool(func=_get_ecommerce_overview, thinking_messages=["Fetching your e-commerce overview..."], tags=[ToolTag.ANALYTICS])


# ── get_inventory_health ──────────────────────────────────────────────

@tool("get_inventory_health")
async def _get_inventory_health(threshold_days: int = 14) -> dict:
    """Check inventory health: low-stock alerts, out-of-stock products, and days until stockout.
    Use when the user asks about inventory, stock levels, or supply issues."""
    org_id = get_org_id()
    resp = await commerce_client.get(f"/inventory/health?org_id={org_id}&threshold={threshold_days}")
    body = resp.get("body", {})

    def to_alert(item: dict) -> InventoryAlertRow:
        return InventoryAlertRow(
            product_id=item.get("product_id") or item.get("id", ""),
            title=item.get("title", ""),
            inventory_qty=item.get("inventoryQty") or item.get("inventory_qty", 0),
            days_until_stockout=item.get("daysUntilStockout") or item.get("days_until_stockout"),
            at_risk_revenue=item.get("atRiskRevenue") or item.get("at_risk_revenue", 0.0),
            severity=item.get("severity", "low"),
        )

    low_stock = [to_alert(i) for i in body.get("low_stock", [])]
    out_of_stock = [to_alert(i) for i in body.get("out_of_stock", [])]
    total_at_risk = body.get("total_at_risk_revenue") or body.get("totalAtRiskRevenue", 0.0)

    summary = f"{len(out_of_stock)} out of stock, {len(low_stock)} low stock. At-risk revenue: ${total_at_risk:,.2f}."

    return ToolResponse(
        summary=summary,
        data=body,
        ui_blocks=[inventory_card_block.create(data=InventoryCardData(
            low_stock=low_stock,
            out_of_stock=out_of_stock,
            total_at_risk_revenue=total_at_risk,
            threshold_days=threshold_days,
        ))],
    ).model_dump()

get_inventory_health = AgenticTool(func=_get_inventory_health, thinking_messages=["Checking your inventory levels..."], tags=[ToolTag.ANALYTICS])


# ── get_product_insights ──────────────────────────────────────────────

@tool("get_product_insights")
async def _get_product_insights(product_id: str) -> dict:
    """Get deep insights for a specific product: revenue, ad performance, and recommendations.
    Use when the user asks about a specific product's performance or ad readiness."""
    org_id = get_org_id()
    resp = await commerce_client.get(f"/products/{product_id}?org_id={org_id}")
    body = resp.get("body", {})

    revenue = body.get("revenueL30d") or body.get("revenue_l30d", 0.0)
    velocity = body.get("salesVelocity") or body.get("sales_velocity", 0.0)
    inv = body.get("inventoryQty") or body.get("inventory_qty", 0)
    price = body.get("price", 0.0)
    title = body.get("title", product_id)

    metrics = [
        MetricItem(label="30d Revenue", value=f"${revenue:,.2f}"),
        MetricItem(label="Daily Velocity", value=f"{velocity:.1f} units/day"),
        MetricItem(label="Inventory", value=str(inv)),
        MetricItem(label="Price", value=f"${price:.2f}"),
    ]

    return ToolResponse(
        summary=f"{title}: ${revenue:,.2f} revenue in 30 days, {velocity:.1f} units/day velocity.",
        data=body,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(metrics=metrics, title=f"Product Insights: {title}"))],
    ).model_dump()

get_product_insights = AgenticTool(func=_get_product_insights, thinking_messages=["Analyzing product performance..."], tags=[ToolTag.ANALYTICS])

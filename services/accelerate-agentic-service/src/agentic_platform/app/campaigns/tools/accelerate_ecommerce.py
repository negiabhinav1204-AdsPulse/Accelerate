"""Accelerate ecommerce proxy tools.

Proxies the 6 ecommerce data tools from the Accelerate Next.js service.
"""

from typing import Optional
from pydantic import Field

from src.agentic_platform.core.engine.models import ToolTag
from src.agentic_platform.app.campaigns.tools.accelerate_tools import make_accelerate_tool

# ── get_products ────────────────────────────────────────────────────────────

get_products = make_accelerate_tool(
    name="get_products",
    description=(
        "List products from connected commerce stores. Returns product titles, prices, "
        "inventory, and 30-day sales velocity. Use when the user asks about products, "
        "catalog, or which items to advertise."
    ),
    field_definitions={
        "limit": (
            Optional[int],
            Field(default=20, description="Max products to return (1–50, default 20)"),
        ),
        "sort": (
            Optional[str],
            Field(
                default="velocity_desc",
                description=(
                    "Sort order: velocity_desc (top sellers by 30d velocity), "
                    "revenue_desc (top by revenue), inventory_asc (low stock first), title_asc"
                ),
            ),
        ),
        "status": (
            Optional[str],
            Field(default="active", description="Filter by status: active, draft. Default: active."),
        ),
    },
    thinking_messages=["Fetching your product catalog...", "Loading products..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── get_sales ───────────────────────────────────────────────────────────────

get_sales = make_accelerate_tool(
    name="get_sales",
    description=(
        "Get real sales and orders data for a time period. Returns order count, total "
        "revenue, AOV, and top-selling products scoped to the period. Use when asked "
        "about sales performance, revenue, or orders."
    ),
    field_definitions={
        "days": (
            Optional[int],
            Field(default=30, description="Number of days to look back (default 30)"),
        ),
    },
    thinking_messages=["Pulling your sales data...", "Looking up orders..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── get_ecommerce_overview ──────────────────────────────────────────────────

get_ecommerce_overview = make_accelerate_tool(
    name="get_ecommerce_overview",
    description=(
        "Get full ecommerce KPI overview: revenue, orders, AOV, new customers, repeat "
        "rate, and period-over-period comparison. Best for 'how is the store doing' or "
        "'ecommerce performance' questions."
    ),
    field_definitions={
        "period": (
            Optional[str],
            Field(default="30d", description="Period: 7d, 30d, or 90d. Default: 30d."),
        ),
    },
    thinking_messages=["Loading ecommerce overview...", "Pulling store KPIs..."],
    tags=[ToolTag.ANALYTICS],
    timeout=60,
)

# ── get_inventory_health ────────────────────────────────────────────────────

get_inventory_health = make_accelerate_tool(
    name="get_inventory_health",
    description=(
        "Get inventory health report: low-stock items, out-of-stock products, sales "
        "velocity, and estimated days-until-stockout. Use for 'what products are running "
        "low', 'inventory status', or 'out of stock' queries."
    ),
    field_definitions={
        "threshold": (
            Optional[int],
            Field(default=10, description="Stock quantity threshold to flag as low (default 10)"),
        ),
    },
    thinking_messages=["Checking inventory levels...", "Scanning stock health..."],
    tags=[ToolTag.DIAGNOSTICS],
    timeout=60,
)

# ── get_product_insights ────────────────────────────────────────────────────

get_product_insights = make_accelerate_tool(
    name="get_product_insights",
    description=(
        "Get AI-generated insights for a specific product: performance analysis, ad "
        "readiness score, recommended improvements, and campaign suggestions. Use when "
        "the user asks about a specific product or wants to advertise one product."
    ),
    field_definitions={
        "product_id": (
            Optional[str],
            Field(default=None, description="Product ID to get insights for"),
        ),
        "product_title": (
            Optional[str],
            Field(default=None, description="Product title (use if no product_id)"),
        ),
    },
    thinking_messages=["Analysing product performance...", "Generating product insights..."],
    tags=[ToolTag.RECOMMENDATIONS],
    timeout=60,
)

# ── get_product_suggestions ─────────────────────────────────────────────────

get_product_suggestions = make_accelerate_tool(
    name="get_product_suggestions",
    description=(
        "Get AI-ranked product suggestions for advertising — top products by sales "
        "velocity, ad readiness, and revenue potential. Use when user asks 'what should "
        "I advertise?', 'which products to promote?', or 'best products for ads'."
    ),
    field_definitions={
        "limit": (
            Optional[int],
            Field(default=5, description="Max products to return (default 5, max 10)"),
        ),
    },
    thinking_messages=["Finding your best ad candidates...", "Ranking products for advertising..."],
    tags=[ToolTag.RECOMMENDATIONS],
    timeout=60,
)

# ── Public exports ──────────────────────────────────────────────────────────

ACCELERATE_ECOMMERCE_TOOLS = [
    get_products,
    get_sales,
    get_ecommerce_overview,
    get_inventory_health,
    get_product_insights,
    get_product_suggestions,
]

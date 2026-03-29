"""Ecommerce domain models — products, orders, revenue, inventory."""

from typing import Optional
from pydantic import BaseModel


class Product(BaseModel):
    id: str
    title: str
    price: float
    currency: str = "USD"
    inventory_qty: int = 0
    sales_velocity: float = 0.0        # units sold per day (30d avg)
    revenue_l30d: float = 0.0          # revenue last 30 days
    tag: Optional[str] = None          # "top_seller", "trending", etc.
    ai_recommendation: Optional[str] = None
    image_url: Optional[str] = None
    product_url: Optional[str] = None


class RevenueChannel(BaseModel):
    channel: str
    revenue: float
    orders: int
    percentage: float


class RevenueSummary(BaseModel):
    revenue: float
    orders: int
    aov: float                         # average order value
    new_customers: int = 0
    repeat_rate: float = 0.0           # % repeat customers
    period_days: int = 30
    currency: str = "USD"
    by_channel: list[RevenueChannel] = []


class DailyRevenue(BaseModel):
    date: str
    revenue: float
    orders: int
    ad_spend: float = 0.0


class InventoryAlert(BaseModel):
    product_id: str
    title: str
    inventory_qty: int
    weekly_velocity: float
    days_until_stockout: Optional[float] = None
    at_risk_revenue: float = 0.0
    severity: str = "low"              # "low", "medium", "critical"


class InventoryHealth(BaseModel):
    low_stock: list[InventoryAlert] = []
    out_of_stock: list[InventoryAlert] = []
    total_at_risk_revenue: float = 0.0
    threshold_days: int = 14

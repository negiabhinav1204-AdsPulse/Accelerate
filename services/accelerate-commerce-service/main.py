"""accelerate-commerce-service — FastAPI entry point.

Phase 1: Multi-Platform Commerce Abstraction
  - CommerceAdapter pattern (Shopify, WooCommerce, Wix, BigCommerce, CSV, Manual)
  - Sync pipeline (products + orders) via QStash
  - Section 1.2: POST /connectors/:id/sync → QStash → sync job
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import close_pool, get_pool
from routers.connectors import router as connectors_router
from routers.feeds import router as feeds_router
from routers.inventory import router as inventory_router
from routers.merchant_center import router as merchant_center_router
from routers.products import router as products_router
from routers.revenue import router as revenue_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

app = FastAPI(
    title="Accelerate Commerce Service",
    version="1.0.0",
    description="Multi-platform commerce abstraction: connectors, products, orders, sync pipeline",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(connectors_router)
app.include_router(products_router)
app.include_router(revenue_router)
app.include_router(inventory_router)
app.include_router(feeds_router)
app.include_router(merchant_center_router)


@app.on_event("startup")
async def startup() -> None:
    await get_pool()  # warm up connection pool
    logging.getLogger(__name__).info("Commerce service started")


@app.on_event("shutdown")
async def shutdown() -> None:
    await close_pool()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "accelerate-commerce-service"}

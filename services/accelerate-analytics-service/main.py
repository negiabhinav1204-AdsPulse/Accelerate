"""accelerate-analytics-service — Analytics Intelligence microservice.

Phase 7: Analytics Intelligence
  - Revenue attribution (ad vs organic, per-platform ROAS)
  - Funnel analysis (impression → purchase, by platform)
  - Geographic breakdown (country + city revenue/orders)
  - LLM traffic detection and filtering (ChatGPT, Claude, Perplexity, etc.)
  - AI-generated insights (anomaly detection, actionable recommendations)
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import close_pool, get_pool
from routers.attribution import router as attribution_router
from routers.funnel import router as funnel_router
from routers.geography import router as geography_router
from routers.insights import router as insights_router
from routers.llm_traffic import router as llm_traffic_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    logging.getLogger(__name__).info("Analytics service started")
    yield
    await close_pool()


app = FastAPI(
    title="Accelerate Analytics Service",
    version="1.0.0",
    description=(
        "Analytics Intelligence: revenue attribution, funnel analysis, "
        "geographic breakdown, LLM traffic, and AI-generated insights"
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(attribution_router)
app.include_router(funnel_router)
app.include_router(geography_router)
app.include_router(insights_router)
app.include_router(llm_traffic_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "accelerate-analytics-service", "version": "1.0.0"}

"""accelerate-cdp-service — FastAPI entry point.

Phase 1: Customer Data Platform
  - Customer profiles with identity resolution (Section 1.5)
  - Rules-based audience segments
  - Pixel event ingestion
  - CSV bulk upload
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import close_pool, get_pool
from routers.profiles import router as profiles_router
from routers.segments import router as segments_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

app = FastAPI(
    title="Accelerate CDP Service",
    version="1.0.0",
    description="Customer Data Platform: profiles, identity resolution, segments, event ingestion",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles_router)
app.include_router(segments_router)


@app.on_event("startup")
async def startup() -> None:
    await get_pool()
    logging.getLogger(__name__).info("CDP service started")


@app.on_event("shutdown")
async def shutdown() -> None:
    await close_pool()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "accelerate-cdp-service"}

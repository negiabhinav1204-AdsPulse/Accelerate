import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.database import get_pool, close_pool
from routers.pages import router as pages_router
from routers.zones import router as zones_router
from routers.variants import router as variants_router
from routers.experiments import router as experiments_router
from routers.edge import router as edge_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()

app = FastAPI(title="Accelerate Personalization Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(pages_router, prefix="/pages", tags=["pages"])
app.include_router(zones_router, prefix="/zones", tags=["zones"])
app.include_router(variants_router, prefix="/variants", tags=["variants"])
app.include_router(experiments_router, prefix="/experiments", tags=["experiments"])
app.include_router(edge_router, prefix="/edge", tags=["edge"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "accelerate-personalization-service"}

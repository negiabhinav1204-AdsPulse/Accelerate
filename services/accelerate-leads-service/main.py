"""accelerate-leads-service — FastAPI entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import close_pool, get_pool
from routers.leads import router as leads_router

app = FastAPI(
    title="Accelerate Leads Service",
    version="1.0.0",
    description="Lead form management: create forms, capture submissions, export leads",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leads_router)


@app.on_event("startup")
async def startup():
    await get_pool()


@app.on_event("shutdown")
async def shutdown():
    await close_pool()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "accelerate-leads-service"}

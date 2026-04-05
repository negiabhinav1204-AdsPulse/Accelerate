"""FastAPI application — multi-agent platform.

Thin app shell: lifespan, middleware, global error handler,
and platform-level routes (health, agents, block-schemas).

Chat-specific routes live in api/chat/routes.py.
"""

import logging
import os
from contextlib import asynccontextmanager

# Configure root logger so app-level logger.info() calls are visible in uvicorn output
logging.basicConfig(
    level=getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)

# Suppress noisy "Key 'X' is not supported in schema" from Google GenAI tool binding
logging.getLogger("langchain_google_genai._function_utils").setLevel(logging.ERROR)

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from src.agentic_platform.core.infra.sentry import init_sentry, capture_exception
from src.agentic_platform.core.infra.http_client import AsyncHTTPClient
from src.agentic_platform.api.chat.persistence import Persistence
from src.agentic_platform.core.infra.db.local_persistence import LocalPersistence
from src.agentic_platform.api.chat.routes import router as chat_router
from src.agentic_platform.api.middleware import AuthMiddleware
from src.agentic_platform.core.agents.loader import load_all_agents, cleanup_agents
from src.agentic_platform.app import get_all_agent_configs

logger = logging.getLogger(__name__)


# ── Lifespan ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        if init_sentry():
            logger.info("Sentry error tracking initialized")
        else:
            logger.info("Sentry not configured (SENTRY_DSN not set)")
    except Exception as e:
        logger.warning("Failed to initialize Sentry: %s", e)

    await AsyncHTTPClient.initialize()

    configs = get_all_agent_configs()
    agents = await load_all_agents(configs)

    # Attach chat persistence (API-layer concern) to each loaded agent.
    # Use LocalPersistence (direct Postgres) when db_service_url is not a real external service.
    _local_persistence = LocalPersistence()
    await _local_persistence.setup()
    for agent in agents.values():
        db_url = agent.config.db_service_url
        if not db_url or "localhost" in db_url or "127.0.0.1" in db_url:
            agent.persistence = _local_persistence
            logger.info("Agent '%s': using LocalPersistence (direct Postgres)", agent.config.agent_id)
        else:
            agent.persistence = Persistence(db_url)
            logger.info("Agent '%s': using remote db-service at %s", agent.config.agent_id, db_url)

    app.state.agents = agents

    logger.info("Platform started: %d agents loaded (%s)",
                len(agents), ", ".join(agents.keys()))
    yield

    await cleanup_agents(agents)
    await AsyncHTTPClient.close()


app = FastAPI(title="Accelerate Agentic Platform", lifespan=lifespan)
app.add_middleware(AuthMiddleware)

# Mount chat routes
app.include_router(chat_router, prefix="/api/v1")


# ── Global exception handler ─────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    capture_exception(exc)
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": "An unexpected error occurred"},
    )


# ── Platform routes (not chat-specific) ──────────────────────────────

@app.get("/api/v1/agents/")
async def list_agents(request: Request):
    """List all available agents."""
    return {
        "agents": [
            {"id": a.config.agent_id, "name": a.config.name, "model": a.config.model}
            for a in request.app.state.agents.values()
        ]
    }


@app.get("/api/v1/block-schemas")
async def block_schemas():
    """Export all registered block schemas."""
    from src.agentic_platform.core.engine.blocks import export_block_schemas
    return export_block_schemas()


@app.get("/health")
async def health():
    return {"status": "ok"}

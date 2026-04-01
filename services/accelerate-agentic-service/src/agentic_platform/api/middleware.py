"""Auth middleware — FastAPI middleware that extracts user context from JWT + org headers.

Imports UserContext and helpers from core.auth (no FastAPI in core layer).
"""

import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.agentic_platform.core.auth import (
    UserContext,
    request_auth_token,
    _decode_jwt_payload,
)

logger = logging.getLogger(__name__)

# Routes that don't require auth
_PUBLIC_PATHS = {"/health", "/api/v1/block-schemas"}


class AuthMiddleware(BaseHTTPMiddleware):
    """Extracts user context from JWT + X-Org-Id header.

    Sets request.state.user (UserContext) and request_auth_token ContextVar.
    """

    async def dispatch(self, request: Request, call_next):
        from src.agentic_platform.core.config import settings

        if request.url.path.rstrip("/") in _PUBLIC_PATHS:
            request.state.user = None
            return await call_next(request)

        # Capture raw token from request (if any)
        auth_header = request.headers.get("authorization", "")
        raw_token = auth_header[7:] if auth_header.lower().startswith("bearer ") else ""

        # Local dev mode — skip JWT validation, use configured identity
        if settings.local_override_org_context:
            token = settings.local_dev_auth_token or raw_token
            request_auth_token.set(token)
            request.state.user = UserContext(
                user_id=settings.local_dev_user_id,
                email=settings.local_dev_user_email,
                name="Local Dev User",
                org_id=settings.local_dev_org_id,
            )
            return await call_next(request)

        # Internal service call — bypass JWT if x-internal-api-key matches
        internal_key = request.headers.get("x-internal-api-key", "")
        if internal_key and settings.internal_api_key and internal_key == settings.internal_api_key:
            request_auth_token.set(raw_token)
            request.state.user = UserContext(
                user_id=request.headers.get("x-user-id", "internal"),
                email="internal@accelerate.ai",
                name="Accelerate Dashboard",
                org_id=request.headers.get("x-org-id", ""),
            )
            return await call_next(request)

        # Production — validate JWT
        if not raw_token:
            return JSONResponse(status_code=401, content={"detail": "Missing Authorization header"})

        try:
            claims = _decode_jwt_payload(raw_token)
        except ValueError:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})

        request_auth_token.set(raw_token)

        request.state.user = UserContext(
            user_id=request.headers.get("x-user-id", ""),
            email=claims.get("email", ""),
            name=claims.get("name", ""),
            org_id=request.headers.get("x-org-id", ""),
        )

        return await call_next(request)

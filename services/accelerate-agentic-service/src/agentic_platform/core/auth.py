"""Auth core — user context and JWT decoding. NO FastAPI imports.

The JWT (from IAM) contains user identity: sub, email, name.
The org context comes from the `X-Org-Id` header (set by the UI which
knows the active organization from OrganizationContext).

Auth token forwarding:
    The raw Bearer token is stored in a request-scoped ContextVar
    (`request_auth_token`). Any code in the request can read it —
    no manual threading through graph config or workflow steps needed.

    from src.agentic_platform.core.auth import request_auth_token
    token = request_auth_token.get()  # "" if none
"""

import json
import logging
from base64 import urlsafe_b64decode
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# ── Request-scoped auth token ────────────────────────────────────────
# Set by AuthMiddleware, readable anywhere in the same async context.
# Downstream HTTP clients (campaign_client, etc.) read this automatically.
request_auth_token: ContextVar[str] = ContextVar("request_auth_token", default="")


@dataclass
class UserContext:
    """User identity + domain context.

    Core fields (user_id, email, name, org_id) come from auth middleware.
    Domain-specific data goes in `domain_context` — a generic dict that
    domains populate via AgentConfig.hydrate_context(). No domain-specific
    fields on this class.

    Auth token is NOT here — it's in the `request_auth_token` ContextVar.
    """
    user_id: str
    email: str
    name: str
    org_id: str
    domain_context: dict[str, Any] = field(default_factory=dict)

    def to_config(self) -> dict:
        """Return a dict suitable for LangGraph metadata."""
        base: dict[str, Any] = {
            "user_id": self.user_id,
            "email": self.email,
            "org_id": self.org_id,
        }
        for key, value in self.domain_context.items():
            if isinstance(value, list):
                base[key] = [v.model_dump() if hasattr(v, 'model_dump') else v for v in value]
            elif hasattr(value, 'model_dump'):
                base[key] = value.model_dump()
            else:
                base[key] = value
        return base


def _decode_jwt_payload(token: str) -> dict:
    """Decode JWT payload WITHOUT signature verification."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT format")
        payload = parts[1]
        payload += "=" * (4 - len(payload) % 4)
        return json.loads(urlsafe_b64decode(payload))
    except Exception as e:
        raise ValueError(f"Invalid JWT: {e}") from e

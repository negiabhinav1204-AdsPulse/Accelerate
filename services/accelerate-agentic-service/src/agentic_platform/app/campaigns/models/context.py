"""Campaign context — single source of truth for who the user is and what they can do.

Built once per request in hydrate_campaign_context(). Persisted in workflow
step data to survive HITL checkpoint resume. Read by all workflow steps
and the dynamic system prompt.

Usage:
    from src.agentic_platform.app.campaigns.models import CampaignContext

    # In workflow steps:
    campaign_ctx = CampaignContext.from_step_data(data)

    # For system prompt:
    campaign_ctx.to_prompt_json()
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from .connections import ConnectedPlatform


class CampaignContext(BaseModel):
    """Everything downstream code needs about the current user + org + connections."""
    org_id: str
    user_id: str
    email: str = ""

    # ALL connected platforms (valid token, regardless of capability matrix)
    all_connections: list[ConnectedPlatform] = []

    # Only platforms where we can actually create campaigns (matrix-filtered)
    supported_connections: list[ConnectedPlatform] = []

    model_config = {"frozen": False}

    @property
    def has_supported_connections(self) -> bool:
        return len(self.supported_connections) > 0

    @property
    def supported_platform_names(self) -> set[str]:
        return {c.platform for c in self.supported_connections}

    def get_account_id(self, platform: str) -> str:
        """Get account_id for a platform from supported connections."""
        return next(
            (c.account_id or "" for c in self.supported_connections if c.platform == platform),
            "",
        )

    def get_customer_id(self, platform: str) -> str:
        """Get customer_id for a platform from supported connections."""
        return next(
            (c.customer_id or "" for c in self.supported_connections if c.platform == platform),
            "",
        )

    def to_prompt_json(self) -> str:
        """Render as JSON for the system prompt. Shows ALL connections, not just supported."""
        data = {
            "org_id": self.org_id,
            "connected_platforms": [
                {
                    "platform": c.platform,
                    "account_name": c.account_name,
                    "currency": c.currency,
                    "timezone": c.timezone,
                    "can_create_campaigns": c.platform in self.supported_platform_names,
                }
                for c in self.all_connections
            ],
            "supported_platforms": sorted(self.supported_platform_names),
        }
        return self.model_validate(self).model_dump_json(exclude={"all_connections", "supported_connections"}, indent=2) if False else _json_dumps(data)

    def to_step_data(self) -> dict[str, Any]:
        """Serialize for persistence in workflow step data (survives HITL checkpoint)."""
        return {"_campaign_context": self.model_dump()}

    @classmethod
    def from_step_data(cls, data: dict[str, Any]) -> CampaignContext | None:
        """Recover from workflow step data after HITL checkpoint resume."""
        raw = data.get("_campaign_context")
        if not raw:
            return None
        return cls.model_validate(raw)

    @classmethod
    def from_metadata(cls, metadata: dict[str, Any]) -> CampaignContext | None:
        """Recover from LangGraph config metadata (first run, no HITL)."""
        raw = metadata.get("campaign_context")
        if not raw:
            return None
        return cls.model_validate(raw)


def _json_dumps(data: dict) -> str:
    import json
    return json.dumps(data, indent=2, default=str)

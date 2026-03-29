"""
Persistence client for accelerate-db-service.

Wraps ServiceClient("db-service") with domain-specific methods for
saving/loading conversations and messages via the REST API.
"""

import logging
from typing import Any

from src.agentic_platform.core.infra.http_client import ServiceClient
from src.agentic_platform.core.infra.http_client.exceptions import HTTPClientError, HTTPStatusError

logger = logging.getLogger(__name__)


class Persistence:
    """High-level persistence API backed by db-service REST endpoints."""

    def __init__(self, db_service_url: str):
        self._client = ServiceClient("db-service", base_url=db_service_url)

    async def create_conversation(
        self,
        conversation_id: str | None = None,
        user_id: str = "anonymous",
        org_id: str = "default",
        title: str = "",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"user_id": user_id, "org_id": org_id, "title": title}
        if conversation_id:
            payload["id"] = conversation_id
        resp = await self._client.post(
            "/agentic-chat/conversations/",
            json=payload,
        )
        return resp["body"]

    async def get_or_create_conversation(
        self,
        conversation_id: str,
        user_id: str = "anonymous",
        org_id: str = "default",
    ) -> dict[str, Any]:
        """Get existing conversation or create one with the given ID.

        Tries CREATE first — for new conversations this succeeds immediately.
        On duplicate (400 from Django IntegrityError), falls back to GET.
        This avoids the noisy 404 traceback in db-service logs that happened
        with the old GET-first approach.
        """
        try:
            return await self.create_conversation(
                conversation_id=conversation_id,
                user_id=user_id, org_id=org_id,
            )
        except (HTTPStatusError, HTTPClientError):
            # Already exists (400/409) or other error — try GET
            try:
                resp = await self._client.get(
                    f"/agentic-chat/conversations/{conversation_id}/",
                    retry_attempts=1,
                )
                return resp["body"]
            except HTTPStatusError:
                raise

    async def get_conversation(self, conversation_id: str) -> dict[str, Any]:
        resp = await self._client.get(f"/agentic-chat/conversations/{conversation_id}/")
        return resp["body"]

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        blocks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        resp = await self._client.post(
            "/agentic-chat/messages/",
            json={
                "conversation": conversation_id,
                "role": role,
                "blocks": blocks,
            },
        )
        return resp["body"]

    async def get_messages(self, conversation_id: str) -> list[dict[str, Any]]:
        resp = await self._client.get(
            "/agentic-chat/messages/",
            params={"conversation": conversation_id},
        )
        body = resp["body"]
        return body if isinstance(body, list) else body.get("results", [])

    async def update_hitl_block(
        self,
        conversation_id: str,
        hitl_id: str,
        status: str,
        resolved_action: str | None = None,
    ) -> None:
        """Update a HITL block's status in the persisted message."""
        await self._client.post(
            "/agentic-chat/messages/resolve-hitl/",
            json={
                "conversation": conversation_id,
                "hitl_id": hitl_id,
                "status": status,
                "resolved_action": resolved_action,
            },
        )

    # ── Workflow State ──────────────────────────────────────────────────

    async def create_workflow(
        self,
        conversation_id: str,
        workflow_name: str,
        run_id: str,
        thread_id: str,
        activity_content: dict[str, Any] | None = None,
        status: str = "active",
    ) -> dict[str, Any]:
        """Create a new workflow state entry."""
        resp = await self._client.post(
            "/agentic-chat/workflows/",
            json={
                "conversation": conversation_id,
                "workflow_name": workflow_name,
                "run_id": run_id,
                "thread_id": thread_id,
                "activity_content": activity_content or {},
                "status": status,
            },
        )
        return resp["body"]

    async def update_workflow(
        self,
        workflow_id: str,
        activity_content: dict[str, Any],
        status: str | None = None,
    ) -> None:
        """Update a workflow's activity_content and optionally its status."""
        payload: dict[str, Any] = {"activity_content": activity_content}
        if status:
            payload["status"] = status
        await self._client.patch(
            f"/agentic-chat/workflows/{workflow_id}/",
            json=payload,
        )

    async def get_active_workflows(
        self,
        conversation_id: str,
    ) -> list[dict[str, Any]]:
        """Get all workflows for a conversation (most recent first)."""
        resp = await self._client.get(
            "/agentic-chat/workflows/",
            params={"conversation": conversation_id},
        )
        body = resp["body"]
        return body if isinstance(body, list) else body.get("results", [])

    async def get_workflow(self, workflow_id: str) -> dict[str, Any]:
        """Get a single workflow state by ID."""
        resp = await self._client.get(f"/agentic-chat/workflows/{workflow_id}/")
        return resp["body"]

    async def get_latest_conversation(
        self,
        user_id: str,
        org_id: str,
    ) -> dict[str, Any] | None:
        """Get the most recent conversation for a user+org pair.

        Returns None if no conversation exists yet.
        """
        try:
            resp = await self._client.get(
                "/agentic-chat/conversations/",
                params={"user_id": user_id, "org_id": org_id, "page": 1},
            )
            body = resp["body"]
            results = body if isinstance(body, list) else body.get("results", [])
            return results[0] if results else None
        except Exception:
            return None

    async def health_check(self) -> bool:
        try:
            await self._client.get("/health/", retry_attempts=1)
            return True
        except HTTPClientError:
            logger.warning("db-service health check failed")
            return False

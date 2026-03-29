"""Tests for Persistence client."""

import pytest
import httpx
import respx

from src.agentic_platform.core.infra.http_client.client import AsyncHTTPClient
from src.agentic_platform.core.infra.http_client.config import HTTPClientConfig, RetryConfig
from src.agentic_platform.api.chat.persistence import Persistence


DB_URL = "http://db-service:8000"


@pytest.fixture(autouse=True)
async def init_client():
    cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=1, base_delay=0.01))
    await AsyncHTTPClient.initialize(cfg)
    yield
    await AsyncHTTPClient.close()


@pytest.fixture
def persistence():
    return Persistence(DB_URL)


class TestCreateConversation:
    @respx.mock
    async def test_create_without_id(self, persistence):
        respx.post(f"{DB_URL}/agentic-chat/conversations/").mock(
            return_value=httpx.Response(201, json={
                "id": "aaaa-bbbb", "user_id": "anonymous", "org_id": "default", "title": "",
            })
        )
        result = await persistence.create_conversation()
        assert result["id"] == "aaaa-bbbb"

    @respx.mock
    async def test_create_with_id(self, persistence):
        respx.post(f"{DB_URL}/agentic-chat/conversations/").mock(
            return_value=httpx.Response(201, json={
                "id": "my-uuid", "user_id": "user1", "org_id": "org1", "title": "Test",
            })
        )
        result = await persistence.create_conversation(
            conversation_id="my-uuid", user_id="user1", org_id="org1", title="Test",
        )
        assert result["id"] == "my-uuid"


class TestGetOrCreateConversation:
    @respx.mock
    async def test_existing_conversation(self, persistence):
        """CREATE-first: POST returns 400 (duplicate), then GET succeeds."""
        respx.post(f"{DB_URL}/agentic-chat/conversations/").mock(
            return_value=httpx.Response(400, json={"detail": "duplicate"})
        )
        respx.get(f"{DB_URL}/agentic-chat/conversations/existing-id/").mock(
            return_value=httpx.Response(200, json={"id": "existing-id", "title": "Old"})
        )
        result = await persistence.get_or_create_conversation("existing-id")
        assert result["id"] == "existing-id"

    @respx.mock
    async def test_new_conversation(self, persistence):
        """CREATE-first: POST succeeds for new conversation."""
        respx.post(f"{DB_URL}/agentic-chat/conversations/").mock(
            return_value=httpx.Response(201, json={
                "id": "new-id", "user_id": "anonymous", "org_id": "default",
            })
        )
        result = await persistence.get_or_create_conversation("new-id")
        assert result["id"] == "new-id"


class TestAddMessage:
    @respx.mock
    async def test_add_message(self, persistence):
        respx.post(f"{DB_URL}/agentic-chat/messages/").mock(
            return_value=httpx.Response(201, json={
                "id": "msg-1", "conversation": "conv-1", "role": "user",
                "sequence": 1, "blocks": [{"type": "text", "content": "Hello"}],
            })
        )
        result = await persistence.add_message(
            "conv-1", "user", [{"type": "text", "content": "Hello"}],
        )
        assert result["role"] == "user"
        assert result["sequence"] == 1

    @respx.mock
    async def test_does_not_send_sequence(self, persistence):
        """Sequence is auto-assigned by db-service, not sent by client."""
        route = respx.post(f"{DB_URL}/agentic-chat/messages/").mock(
            return_value=httpx.Response(201, json={"id": "msg", "sequence": 1})
        )
        await persistence.add_message("conv-1", "user", [{"type": "text", "content": "Hi"}])

        import json
        body = json.loads(route.calls[0].request.read())
        assert "sequence" not in body
        assert body["conversation"] == "conv-1"
        assert body["role"] == "user"


class TestGetMessages:
    @respx.mock
    async def test_get_messages_list(self, persistence):
        respx.get(f"{DB_URL}/agentic-chat/messages/").mock(
            return_value=httpx.Response(200, json=[
                {"id": "1", "role": "user"}, {"id": "2", "role": "assistant"},
            ])
        )
        msgs = await persistence.get_messages("conv-1")
        assert len(msgs) == 2

    @respx.mock
    async def test_get_messages_paginated(self, persistence):
        respx.get(f"{DB_URL}/agentic-chat/messages/").mock(
            return_value=httpx.Response(200, json={
                "count": 2,
                "results": [{"id": "1"}, {"id": "2"}],
            })
        )
        msgs = await persistence.get_messages("conv-1")
        assert len(msgs) == 2


class TestHealthCheck:
    @respx.mock
    async def test_health_ok(self, persistence):
        respx.get(f"{DB_URL}/health/").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )
        assert await persistence.health_check() is True

    @respx.mock
    async def test_health_down(self, persistence):
        respx.get(f"{DB_URL}/health/").mock(
            side_effect=httpx.ConnectError("refused")
        )
        assert await persistence.health_check() is False

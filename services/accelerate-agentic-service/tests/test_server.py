"""Tests for FastAPI server endpoints."""

import json
import pytest
import httpx
import respx

from httpx import ASGITransport, AsyncClient
from langchain_core.messages import AIMessageChunk

from src.agentic_platform.api.server import app
from src.agentic_platform.core.agents.config import AgentConfig
from src.agentic_platform.core.agents.loader import LoadedAgent


DB_URL = "http://localhost:8000"
AGENT_ID = "test-agent"
CHAT = f"/api/v1/agents/{AGENT_ID}/chat"
MSGS = f"/api/v1/agents/{AGENT_ID}/conversations"

# Test JWT: {"sub":"test-user","email":"test@test.com","name":"Test User"}
_TEST_JWT = "eyJhbGciOiAibm9uZSJ9.eyJzdWIiOiAidGVzdC11c2VyIiwgImVtYWlsIjogInRlc3RAdGVzdC5jb20iLCAibmFtZSI6ICJUZXN0IFVzZXIifQ.x"
_AUTH = {"Authorization": f"Bearer {_TEST_JWT}", "X-Org-Id": "test-org"}


def _ag_ui_input(message: str, thread_id: str = "") -> dict:
    """Build AG-UI RunAgentInput body for tests (camelCase — matches frontend)."""
    return {
        "threadId": thread_id,
        "runId": "test-run",
        "messages": [{"id": "m1", "role": "user", "content": message}],
        "tools": [],
        "context": [],
        "state": {},
        "forwardedProps": {},
    }


class FakeGraph:
    async def astream(self, input, *, config=None, stream_mode=None, version="v2", **kwargs):
        yield {"type": "messages", "ns": (), "data": (AIMessageChunk(content="Hello "), {"langgraph_node": "agent"})}
        yield {"type": "messages", "ns": (), "data": (AIMessageChunk(content="world!"), {"langgraph_node": "agent"})}


@pytest.fixture(autouse=True)
async def setup_app(monkeypatch):
    from src.agentic_platform.core.config import settings
    from src.agentic_platform.core.infra.http_client.client import AsyncHTTPClient
    from src.agentic_platform.core.infra.http_client.config import HTTPClientConfig, RetryConfig
    from src.agentic_platform.api.chat.persistence import Persistence

    # Tests use explicit auth headers — disable local dev overrides
    monkeypatch.setattr(settings, "local_override_org_context", False)
    monkeypatch.setattr(settings, "local_override_mock_supported_campaigns", False)

    cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=1, base_delay=0.01))
    await AsyncHTTPClient.initialize(cfg)

    fake_config = AgentConfig(
        agent_id=AGENT_ID, name="Test Agent", system_prompt="You are a test agent.",
        checkpointer_db_url="postgresql://test:test@localhost/test",
        db_service_url=DB_URL,
    )
    app.state.agents = {
        AGENT_ID: LoadedAgent(
            config=fake_config,
            graph=FakeGraph(),
            persistence=Persistence(DB_URL),
            checkpointer=None,
        ),
    }
    yield
    await AsyncHTTPClient.close()


class TestHealth:
    async def test_health(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")
        assert resp.status_code == 200


class TestAuth:
    async def test_missing_auth_returns_401(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(f"{CHAT}/", json=_ag_ui_input("Hi"))
        assert resp.status_code == 401

    async def test_health_skips_auth(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")
        assert resp.status_code == 200


class TestAgentRouting:
    async def test_unknown_agent_returns_404(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/agents/nonexistent/chat/", json=_ag_ui_input("Hi"), headers=_AUTH,
            )
        assert resp.status_code == 404

    async def test_list_agents(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/agents/", headers=_AUTH)
        assert resp.status_code == 200
        agents = resp.json()["agents"]
        assert len(agents) == 1
        assert agents[0]["id"] == AGENT_ID


class TestChat:
    @respx.mock
    async def test_chat_streams_sse(self):
        respx.get(url__regex=r".*/agentic-chat/conversations/.*").mock(
            return_value=httpx.Response(404, json={"detail": "Not found"})
        )
        respx.post(f"{DB_URL}/agentic-chat/conversations/").mock(
            return_value=httpx.Response(201, json={"id": "test-conv"})
        )
        respx.post(f"{DB_URL}/agentic-chat/messages/").mock(
            return_value=httpx.Response(201, json={"id": "msg-1", "sequence": 1})
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"{CHAT}/550e8400-e29b-41d4-a716-446655440000",
                json=_ag_ui_input("Hi"), headers=_AUTH,
            )

        assert resp.status_code == 200
        events = [json.loads(l[6:]) for l in resp.text.split("\n") if l.startswith("data: ")]
        types = [e["type"] for e in events]
        assert "RUN_STARTED" in types
        assert "TEXT_MESSAGE_CONTENT" in types
        assert "RUN_FINISHED" in types

    @respx.mock
    async def test_chat_without_conv_id(self):
        respx.get(url__regex=r".*/agentic-chat/conversations/.*").mock(
            return_value=httpx.Response(404, json={"detail": "Not found"})
        )
        respx.post(f"{DB_URL}/agentic-chat/conversations/").mock(
            return_value=httpx.Response(201, json={"id": "auto"})
        )
        respx.post(f"{DB_URL}/agentic-chat/messages/").mock(
            return_value=httpx.Response(201, json={"id": "msg-1", "sequence": 1})
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(f"{CHAT}/", json=_ag_ui_input("Hi"), headers=_AUTH)

        assert resp.status_code == 200
        events = [json.loads(l[6:]) for l in resp.text.split("\n") if l.startswith("data: ")]
        run_started = next(e for e in events if e["type"] == "RUN_STARTED")
        assert len(run_started["threadId"]) == 36

    @respx.mock
    async def test_chat_persists_despite_db_failure(self):
        respx.route(method="GET").mock(return_value=httpx.Response(404))
        respx.route(method="POST").mock(return_value=httpx.Response(400))

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"{CHAT}/550e8400-e29b-41d4-a716-446655440000",
                json=_ag_ui_input("Hi"), headers=_AUTH,
            )

        assert resp.status_code == 200
        assert "Hello " in resp.text


class TestGetMessages:
    @respx.mock
    async def test_get_messages(self):
        respx.get(f"{DB_URL}/agentic-chat/conversations/550e8400-e29b-41d4-a716-446655440000/").mock(
            return_value=httpx.Response(200, json={
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "org_id": "test-org",
            })
        )
        respx.get(f"{DB_URL}/agentic-chat/messages/").mock(
            return_value=httpx.Response(200, json=[
                {"id": "1", "role": "user", "blocks": [{"type": "text", "content": "Hi"}]},
                {"id": "2", "role": "assistant", "blocks": [{"type": "text", "content": "Hello!"}]},
            ])
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                f"{MSGS}/550e8400-e29b-41d4-a716-446655440000/messages",
                headers=_AUTH,
            )

        assert resp.status_code == 200
        assert len(resp.json()["messages"]) == 2

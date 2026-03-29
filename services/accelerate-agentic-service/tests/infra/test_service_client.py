"""Tests for ServiceClient — per-downstream wrapper."""

import pytest
import httpx
import respx

from src.agentic_platform.core.infra.http_client.client import AsyncHTTPClient
from src.agentic_platform.core.infra.http_client.config import HTTPClientConfig, RetryConfig
from src.agentic_platform.core.infra.http_client.service_client import ServiceClient
from src.agentic_platform.core.infra.http_client.exceptions import HTTPStatusError


@pytest.fixture(autouse=True)
async def init_client():
    cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=1, base_delay=0.01))
    await AsyncHTTPClient.initialize(cfg)
    yield
    await AsyncHTTPClient.close()


class TestServiceClient:
    def test_build_url(self):
        svc = ServiceClient("db", base_url="http://localhost:8000")
        assert svc._build_url("/api/items") == "http://localhost:8000/api/items"
        assert svc._build_url("api/items") == "http://localhost:8000/api/items"

    def test_build_url_strips_trailing_slash(self):
        svc = ServiceClient("db", base_url="http://localhost:8000/")
        assert svc._build_url("/api/items") == "http://localhost:8000/api/items"

    def test_merge_headers(self):
        svc = ServiceClient("db", base_url="http://x", default_headers={"X-Org": "acme"})
        merged = svc._merge_headers({"X-Request-Id": "123"})
        assert merged == {"X-Org": "acme", "X-Request-Id": "123"}

    def test_merge_headers_override(self):
        svc = ServiceClient("db", base_url="http://x", default_headers={"X-Org": "acme"})
        merged = svc._merge_headers({"X-Org": "other"})
        assert merged["X-Org"] == "other"

    def test_merge_headers_none(self):
        svc = ServiceClient("db", base_url="http://x", default_headers={"X-Org": "acme"})
        merged = svc._merge_headers(None)
        assert merged == {"X-Org": "acme"}

    @respx.mock
    async def test_get(self):
        respx.get("http://db:8000/api/items").mock(
            return_value=httpx.Response(200, json=[{"id": 1}])
        )
        svc = ServiceClient("db", base_url="http://db:8000")
        resp = await svc.get("/api/items")
        assert resp["status_code"] == 200
        assert resp["body"] == [{"id": 1}]

    @respx.mock
    async def test_post(self):
        respx.post("http://db:8000/api/items").mock(
            return_value=httpx.Response(201, json={"id": "new"})
        )
        svc = ServiceClient("db", base_url="http://db:8000")
        resp = await svc.post("/api/items", json={"name": "test"})
        assert resp["status_code"] == 201

    @respx.mock
    async def test_put(self):
        respx.put("http://db:8000/api/items/1").mock(
            return_value=httpx.Response(200, json={"updated": True})
        )
        svc = ServiceClient("db", base_url="http://db:8000")
        resp = await svc.put("/api/items/1", json={"name": "new"})
        assert resp["status_code"] == 200

    @respx.mock
    async def test_patch(self):
        respx.patch("http://db:8000/api/items/1").mock(
            return_value=httpx.Response(200, json={"patched": True})
        )
        svc = ServiceClient("db", base_url="http://db:8000")
        resp = await svc.patch("/api/items/1", json={"name": "new"})
        assert resp["status_code"] == 200

    @respx.mock
    async def test_delete(self):
        respx.delete("http://db:8000/api/items/1").mock(
            return_value=httpx.Response(204, text="")
        )
        svc = ServiceClient("db", base_url="http://db:8000")
        resp = await svc.delete("/api/items/1")
        assert resp["status_code"] == 204

    @respx.mock
    async def test_service_name_tagged_in_error(self):
        respx.get("http://db:8000/missing").mock(
            return_value=httpx.Response(404, json={"detail": "not found"})
        )
        svc = ServiceClient("db-service", base_url="http://db:8000")
        with pytest.raises(HTTPStatusError) as exc_info:
            await svc.get("/missing")
        assert exc_info.value.service_name == "db-service"

    @respx.mock
    async def test_default_headers_sent(self):
        route = respx.get("http://db:8000/api/items").mock(
            return_value=httpx.Response(200, json=[])
        )
        svc = ServiceClient(
            "db", base_url="http://db:8000",
            default_headers={"Authorization": "Bearer tok123"},
        )
        await svc.get("/api/items")
        assert route.calls[0].request.headers["authorization"] == "Bearer tok123"

    @respx.mock
    async def test_per_request_timeout_override(self):
        respx.get("http://db:8000/slow").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        svc = ServiceClient("db", base_url="http://db:8000")
        resp = await svc.get("/slow", timeout=120.0)
        assert resp["status_code"] == 200

"""Tests for AsyncHTTPClient — singleton, retry, circuit breaker."""

import asyncio
import pytest
import httpx
import respx

from src.agentic_platform.core.infra.http_client.client import AsyncHTTPClient, get_http_client
from src.agentic_platform.core.infra.http_client.config import HTTPClientConfig, RetryConfig, CircuitBreakerConfig
from src.agentic_platform.core.infra.http_client.exceptions import (
    CircuitBreakerOpen,
    ConnectionError,
    HTTPStatusError,
    RequestTimeout,
    RetryExhausted,
)


@pytest.fixture(autouse=True)
async def reset_client():
    """Ensure client is clean before/after each test."""
    if AsyncHTTPClient.is_initialized():
        await AsyncHTTPClient.close()
    yield
    if AsyncHTTPClient.is_initialized():
        await AsyncHTTPClient.close()


class TestSingleton:
    async def test_initialize_and_close(self):
        await AsyncHTTPClient.initialize()
        assert AsyncHTTPClient.is_initialized()
        await AsyncHTTPClient.close()
        assert not AsyncHTTPClient.is_initialized()

    async def test_get_client_before_init_raises(self):
        with pytest.raises(RuntimeError, match="not initialized"):
            get_http_client()

    async def test_get_client_after_init(self):
        await AsyncHTTPClient.initialize()
        client = get_http_client()
        assert isinstance(client, AsyncHTTPClient)

    async def test_double_initialize_is_noop(self):
        await AsyncHTTPClient.initialize()
        await AsyncHTTPClient.initialize()  # should not raise
        assert AsyncHTTPClient.is_initialized()

    async def test_lifespan_context_manager(self):
        async with AsyncHTTPClient.lifespan():
            assert AsyncHTTPClient.is_initialized()
            client = get_http_client()
            assert client is not None
        assert not AsyncHTTPClient.is_initialized()

    async def test_custom_config(self):
        cfg = HTTPClientConfig(timeout=99, max_connections=50)
        await AsyncHTTPClient.initialize(cfg)
        assert AsyncHTTPClient._config.timeout == 99
        assert AsyncHTTPClient._config.max_connections == 50


class TestRequests:
    @respx.mock
    async def test_get_success(self):
        respx.get("http://test-svc/api/data").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        await AsyncHTTPClient.initialize()
        client = get_http_client()
        resp = await client.get("http://test-svc/api/data", service_name="test")
        assert resp["status_code"] == 200
        assert resp["body"] == {"ok": True}
        assert "elapsed_ms" in resp
        assert "headers" in resp

    @respx.mock
    async def test_post_with_json(self):
        respx.post("http://test-svc/api/items").mock(
            return_value=httpx.Response(201, json={"id": "abc"})
        )
        await AsyncHTTPClient.initialize()
        client = get_http_client()
        resp = await client.post(
            "http://test-svc/api/items",
            json={"name": "test"},
            service_name="test",
        )
        assert resp["status_code"] == 201
        assert resp["body"]["id"] == "abc"

    @respx.mock
    async def test_4xx_raises_status_error(self):
        respx.get("http://test-svc/missing").mock(
            return_value=httpx.Response(404, json={"detail": "not found"})
        )
        await AsyncHTTPClient.initialize()
        client = get_http_client()
        with pytest.raises(HTTPStatusError) as exc_info:
            await client.get("http://test-svc/missing", service_name="test")
        assert exc_info.value.status_code == 404

    @respx.mock
    async def test_5xx_raises_status_error(self):
        respx.get("http://test-svc/error").mock(
            return_value=httpx.Response(500, text="Internal Server Error")
        )
        cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=1))
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        with pytest.raises(HTTPStatusError) as exc_info:
            await client.get("http://test-svc/error", service_name="test")
        assert exc_info.value.status_code == 500

    @respx.mock
    async def test_text_response_body(self):
        respx.get("http://test-svc/text").mock(
            return_value=httpx.Response(200, text="plain text", headers={"content-type": "text/plain"})
        )
        await AsyncHTTPClient.initialize()
        client = get_http_client()
        resp = await client.get("http://test-svc/text", service_name="test")
        assert resp["body"] == "plain text"


class TestRetry:
    @respx.mock
    async def test_retry_on_503_then_success(self):
        route = respx.get("http://test-svc/flaky")
        route.side_effect = [
            httpx.Response(503, text="unavailable"),
            httpx.Response(200, json={"ok": True}),
        ]
        cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=3, base_delay=0.01))
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        resp = await client.get("http://test-svc/flaky", service_name="test")
        assert resp["status_code"] == 200
        assert route.call_count == 2

    @respx.mock
    async def test_retry_exhausted_raises_last_status_error(self):
        route = respx.get("http://test-svc/down")
        route.mock(return_value=httpx.Response(503, text="down"))
        cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=2, base_delay=0.01))
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        with pytest.raises(HTTPStatusError) as exc_info:
            await client.get("http://test-svc/down", service_name="test")
        assert exc_info.value.status_code == 503
        assert route.call_count == 2  # tried twice

    @respx.mock
    async def test_no_retry_on_4xx(self):
        route = respx.get("http://test-svc/bad")
        route.mock(return_value=httpx.Response(400, json={"error": "bad"}))
        cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=3, base_delay=0.01))
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        with pytest.raises(HTTPStatusError):
            await client.get("http://test-svc/bad", service_name="test")
        assert route.call_count == 1  # no retry

    @respx.mock
    async def test_retry_on_429_with_retry_after(self):
        route = respx.get("http://test-svc/rate-limited")
        route.side_effect = [
            httpx.Response(429, text="slow down", headers={"Retry-After": "0.01"}),
            httpx.Response(200, json={"ok": True}),
        ]
        cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=3, base_delay=0.01))
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        resp = await client.get("http://test-svc/rate-limited", service_name="test")
        assert resp["status_code"] == 200

    @respx.mock
    async def test_per_request_retry_override(self):
        route = respx.get("http://test-svc/flaky")
        route.mock(return_value=httpx.Response(503, text="down"))
        cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=5, base_delay=0.01))
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        with pytest.raises(HTTPStatusError) as exc_info:
            await client.get(
                "http://test-svc/flaky", service_name="test", retry_attempts=2,
            )
        assert exc_info.value.status_code == 503
        assert route.call_count == 2  # overridden to 2, not 5


class TestTimeout:
    @respx.mock
    async def test_timeout_raises(self):
        respx.get("http://test-svc/slow").mock(side_effect=httpx.ReadTimeout("timed out"))
        cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=1, retry_on_timeout=False))
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        with pytest.raises(RequestTimeout):
            await client.get("http://test-svc/slow", service_name="test")

    @respx.mock
    async def test_timeout_retried(self):
        route = respx.get("http://test-svc/slow")
        route.side_effect = [
            httpx.ReadTimeout("timed out"),
            httpx.Response(200, json={"ok": True}),
        ]
        cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=2, base_delay=0.01))
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        resp = await client.get("http://test-svc/slow", service_name="test")
        assert resp["status_code"] == 200


class TestConnectionError:
    @respx.mock
    async def test_connect_error_raises(self):
        respx.get("http://test-svc/down").mock(
            side_effect=httpx.ConnectError("Connection refused")
        )
        cfg = HTTPClientConfig(
            retry=RetryConfig(max_attempts=1, retry_on_connection_error=False)
        )
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        with pytest.raises(ConnectionError):
            await client.get("http://test-svc/down", service_name="test")

    @respx.mock
    async def test_connect_error_retried(self):
        route = respx.get("http://test-svc/flaky")
        route.side_effect = [
            httpx.ConnectError("refused"),
            httpx.Response(200, json={"ok": True}),
        ]
        cfg = HTTPClientConfig(retry=RetryConfig(max_attempts=2, base_delay=0.01))
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        resp = await client.get("http://test-svc/flaky", service_name="test")
        assert resp["status_code"] == 200


class TestCircuitBreaker:
    @respx.mock
    async def test_circuit_opens_after_failures(self):
        respx.get("http://test-svc/fail").mock(
            return_value=httpx.Response(500, text="error")
        )
        cfg = HTTPClientConfig(
            retry=RetryConfig(max_attempts=1),
            circuit_breaker=CircuitBreakerConfig(
                enabled=True, failure_threshold=3, recovery_timeout=60,
            ),
        )
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()

        # fail_max=3: 2 failures recorded, 3rd call is rejected by CB
        for _ in range(2):
            with pytest.raises(HTTPStatusError):
                await client.get("http://test-svc/fail", service_name="cb-open-test")

        # 3rd call: circuit breaker rejects
        with pytest.raises(CircuitBreakerOpen) as exc_info:
            await client.get("http://test-svc/fail", service_name="cb-open-test")
        assert exc_info.value.service_name == "cb-open-test"

    @respx.mock
    async def test_circuit_breaker_disabled(self):
        respx.get("http://test-svc/fail").mock(
            return_value=httpx.Response(500, text="error")
        )
        cfg = HTTPClientConfig(
            retry=RetryConfig(max_attempts=1),
            circuit_breaker=CircuitBreakerConfig(enabled=False),
        )
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()

        # Should keep hitting the server, never trip a breaker
        for _ in range(10):
            with pytest.raises(HTTPStatusError):
                await client.get("http://test-svc/fail", service_name="no-cb")

    @respx.mock
    async def test_per_service_isolation(self):
        respx.get("http://svc-a/fail").mock(return_value=httpx.Response(500, text="err"))
        respx.get("http://svc-b/ok").mock(return_value=httpx.Response(200, json={"ok": True}))

        cfg = HTTPClientConfig(
            retry=RetryConfig(max_attempts=1),
            circuit_breaker=CircuitBreakerConfig(
                enabled=True, failure_threshold=3, recovery_timeout=60,
            ),
        )
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()

        # Trip breaker for svc-a (2 failures, 3rd rejected)
        for _ in range(2):
            with pytest.raises(HTTPStatusError):
                await client.get("http://svc-a/fail", service_name="svc-a-iso")

        with pytest.raises(CircuitBreakerOpen):
            await client.get("http://svc-a/fail", service_name="svc-a-iso")

        # svc-b still works (separate breaker)
        resp = await client.get("http://svc-b/ok", service_name="svc-b-iso")
        assert resp["status_code"] == 200

    async def test_circuit_breaker_status(self):
        cfg = HTTPClientConfig(
            circuit_breaker=CircuitBreakerConfig(enabled=True),
        )
        await AsyncHTTPClient.initialize(cfg)
        client = get_http_client()
        status = client.get_circuit_breaker_status()
        assert isinstance(status, dict)


class TestHTTPMethods:
    @respx.mock
    async def test_put(self):
        respx.put("http://test-svc/item/1").mock(
            return_value=httpx.Response(200, json={"updated": True})
        )
        await AsyncHTTPClient.initialize()
        client = get_http_client()
        resp = await client.put("http://test-svc/item/1", json={"name": "x"}, service_name="t")
        assert resp["status_code"] == 200

    @respx.mock
    async def test_patch(self):
        respx.patch("http://test-svc/item/1").mock(
            return_value=httpx.Response(200, json={"patched": True})
        )
        await AsyncHTTPClient.initialize()
        client = get_http_client()
        resp = await client.patch("http://test-svc/item/1", json={"name": "y"}, service_name="t")
        assert resp["status_code"] == 200

    @respx.mock
    async def test_delete(self):
        respx.delete("http://test-svc/item/1").mock(
            return_value=httpx.Response(204, text="")
        )
        await AsyncHTTPClient.initialize()
        client = get_http_client()
        resp = await client.delete("http://test-svc/item/1", service_name="t")
        assert resp["status_code"] == 204

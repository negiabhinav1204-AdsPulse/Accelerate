"""Tests for HTTP client exception hierarchy."""

from src.agentic_platform.core.infra.http_client.exceptions import (
    CircuitBreakerOpen,
    ConnectionError,
    HTTPClientError,
    HTTPStatusError,
    RequestTimeout,
    RetryExhausted,
)


class TestHTTPClientError:
    def test_base_error(self):
        err = HTTPClientError("something broke", service_name="db", url="http://x")
        assert str(err) == "something broke"
        assert err.service_name == "db"
        assert err.url == "http://x"

    def test_to_dict(self):
        err = HTTPClientError("fail", service_name="svc")
        d = err.to_dict()
        assert d["error_type"] == "HTTPClientError"
        assert d["message"] == "fail"
        assert d["service_name"] == "svc"


class TestRequestTimeout:
    def test_fields(self):
        err = RequestTimeout(url="http://x/path", timeout=5.0, service_name="db")
        assert err.timeout == 5.0
        assert "5.0s" in str(err)
        assert err.service_name == "db"

    def test_is_subclass(self):
        assert issubclass(RequestTimeout, HTTPClientError)


class TestConnectionError:
    def test_fields(self):
        original = OSError("refused")
        err = ConnectionError(url="http://x", original_error=original, service_name="db")
        assert err.original_error is original
        assert "refused" in str(err)

    def test_is_subclass(self):
        assert issubclass(ConnectionError, HTTPClientError)


class TestHTTPStatusError:
    def test_fields(self):
        err = HTTPStatusError(
            url="http://x/path",
            status_code=404,
            response_body='{"detail":"not found"}',
            response_headers={"content-type": "application/json"},
            service_name="db",
        )
        assert err.status_code == 404
        assert err.response_body == '{"detail":"not found"}'
        assert "404" in str(err)

    def test_is_retryable(self):
        assert HTTPStatusError("http://x", 429).is_retryable is True
        assert HTTPStatusError("http://x", 503).is_retryable is True
        assert HTTPStatusError("http://x", 404).is_retryable is False
        assert HTTPStatusError("http://x", 400).is_retryable is False

    def test_empty_headers_default(self):
        err = HTTPStatusError("http://x", 500)
        assert err.response_headers == {}


class TestRetryExhausted:
    def test_fields(self):
        last = RequestTimeout("http://x", 5.0)
        err = RetryExhausted(url="http://x", attempts=3, last_error=last, service_name="db")
        assert err.attempts == 3
        assert err.last_error is last
        assert "3 retries" in str(err)


class TestCircuitBreakerOpen:
    def test_fields(self):
        err = CircuitBreakerOpen(service_name="db", reset_timeout=30.0, failure_count=5)
        assert err.reset_timeout == 30.0
        assert err.failure_count == 5
        assert "db" in str(err)
        assert err.service_name == "db"

    def test_is_subclass(self):
        assert issubclass(CircuitBreakerOpen, HTTPClientError)

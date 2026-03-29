"""
HTTP client exceptions with structured error context.

Adapted from accelerate-agentic-framework/v2/infra/http_client/exceptions.py.
"""

from typing import Any


class HTTPClientError(Exception):
    """Base exception for all HTTP client errors."""

    def __init__(self, message: str, service_name: str | None = None, url: str | None = None):
        self.message = message
        self.service_name = service_name
        self.url = url
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "service_name": self.service_name,
            "url": self.url,
        }


class RequestTimeout(HTTPClientError):
    """Raised when a request times out."""

    def __init__(self, url: str, timeout: float, service_name: str | None = None):
        self.timeout = timeout
        super().__init__(
            message=f"Request timed out after {timeout:.1f}s for URL: {url}",
            service_name=service_name,
            url=url,
        )


class ConnectionError(HTTPClientError):
    """Raised when connection to the service fails."""

    def __init__(self, url: str, original_error: Exception, service_name: str | None = None):
        self.original_error = original_error
        super().__init__(
            message=f"Connection failed to {url}: {original_error}",
            service_name=service_name,
            url=url,
        )


class HTTPStatusError(HTTPClientError):
    """Raised when the server returns an error status code (4xx, 5xx)."""

    def __init__(
        self,
        url: str,
        status_code: int,
        response_body: str | None = None,
        response_headers: dict[str, str] | None = None,
        service_name: str | None = None,
    ):
        self.status_code = status_code
        self.response_body = response_body
        self.response_headers = response_headers or {}
        super().__init__(
            message=f"HTTP {status_code} for URL: {url}" + (f"\n{response_body[:500]}" if response_body else ""),
            service_name=service_name,
            url=url,
        )

    @property
    def is_retryable(self) -> bool:
        return self.status_code in (408, 429, 500, 502, 503, 504)


class RetryExhausted(HTTPClientError):
    """Raised when all retry attempts have been exhausted."""

    def __init__(self, url: str, attempts: int, last_error: Exception, service_name: str | None = None):
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(
            message=f"All {attempts} retries exhausted for URL: {url}. Last error: {last_error}",
            service_name=service_name,
            url=url,
        )


class CircuitBreakerOpen(HTTPClientError):
    """Raised when circuit breaker is open and rejecting requests."""

    def __init__(self, service_name: str, reset_timeout: float, failure_count: int):
        self.reset_timeout = reset_timeout
        self.failure_count = failure_count
        super().__init__(
            message=f"Circuit breaker open for '{service_name}' after {failure_count} failures. "
                    f"Recovery in {reset_timeout:.0f}s.",
            service_name=service_name,
        )

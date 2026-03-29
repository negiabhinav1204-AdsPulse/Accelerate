"""
Async HTTP Client Module.

Production-grade, reusable async HTTP client for inter-service communication.

Primary API:
    from src.agentic_platform.core.infra.http_client import ServiceClient

    db = ServiceClient("db-service", base_url=settings.db_service_url)
    resp = await db.post("/agentic-chat/conversations/", json={...})

Lifecycle:
    await AsyncHTTPClient.initialize()   # in FastAPI lifespan
    await AsyncHTTPClient.close()        # on shutdown
"""

from .client import AsyncHTTPClient, get_http_client
from .config import CircuitBreakerConfig, HTTPClientConfig, RetryConfig
from .exceptions import (
    CircuitBreakerOpen,
    ConnectionError,
    HTTPClientError,
    HTTPStatusError,
    RequestTimeout,
    RetryExhausted,
)
from .service_client import ServiceClient

__all__ = [
    "AsyncHTTPClient",
    "get_http_client",
    "ServiceClient",
    "HTTPClientConfig",
    "RetryConfig",
    "CircuitBreakerConfig",
    "HTTPClientError",
    "RequestTimeout",
    "ConnectionError",
    "HTTPStatusError",
    "RetryExhausted",
    "CircuitBreakerOpen",
]

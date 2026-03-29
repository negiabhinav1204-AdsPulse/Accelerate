"""Infrastructure modules for inter-service communication."""

from .http_client import AsyncHTTPClient, ServiceClient, get_http_client

__all__ = ["AsyncHTTPClient", "ServiceClient", "get_http_client"]

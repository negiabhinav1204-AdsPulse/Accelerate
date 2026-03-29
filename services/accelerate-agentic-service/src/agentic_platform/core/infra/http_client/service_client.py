"""
ServiceClient — the primary consumer API for inter-service HTTP calls.

Wraps AsyncHTTPClient with a fixed service name and base URL so consumers
don't repeat boilerplate on every call.

Usage:
    db = ServiceClient("db-service", base_url="http://localhost:8000")
    resp = await db.post("/agentic-chat/conversations/", json={...})
    data = resp["body"]
"""

from typing import Any

from .client import AsyncHTTPClient, get_http_client


class ServiceClient:
    """Per-downstream service wrapper. Set service name + base URL once."""

    def __init__(
        self,
        service_name: str,
        base_url: str,
        default_headers: dict[str, str] | None = None,
    ):
        self.service_name = service_name
        self.base_url = base_url.rstrip("/")
        self.default_headers = default_headers or {}

    def _build_url(self, path: str) -> str:
        path = path if path.startswith("/") else f"/{path}"
        return f"{self.base_url}{path}"

    def _merge_headers(self, headers: dict[str, str] | None) -> dict[str, str]:
        merged = dict(self.default_headers)
        if headers:
            merged.update(headers)
        return merged

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
        retry_attempts: int | None = None,
    ) -> dict[str, Any]:
        client = get_http_client()
        return await client.request(
            method,
            self._build_url(path),
            params=params,
            json=json,
            data=data,
            headers=self._merge_headers(headers),
            timeout=timeout,
            service_name=self.service_name,
            retry_attempts=retry_attempts,
        )

    async def get(self, path: str, **kwargs) -> dict[str, Any]:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs) -> dict[str, Any]:
        return await self.request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs) -> dict[str, Any]:
        return await self.request("PUT", path, **kwargs)

    async def patch(self, path: str, **kwargs) -> dict[str, Any]:
        return await self.request("PATCH", path, **kwargs)

    async def delete(self, path: str, **kwargs) -> dict[str, Any]:
        return await self.request("DELETE", path, **kwargs)

"""
Async HTTP Client with connection pooling, circuit breakers, and Prometheus metrics.

Singleton that owns the shared httpx.AsyncClient pool. ServiceClient wraps this
for per-service ergonomics — most consumers should use ServiceClient, not this directly.
"""

import asyncio
import logging
import random
import time
from contextlib import asynccontextmanager
from typing import Any, Callable

import httpx
import pybreaker

from .config import HTTPClientConfig, default_config
from .exceptions import (
    CircuitBreakerOpen,
    ConnectionError,
    HTTPClientError,
    HTTPStatusError,
    RequestTimeout,
    RetryExhausted,
)
from .metrics import (
    CIRCUIT_BREAKER_STATE,
    HTTP_ERRORS_TOTAL,
    HTTP_REQUEST_DURATION,
    HTTP_REQUESTS_TOTAL,
)

logger = logging.getLogger(__name__)


class _CircuitBreakerListener(pybreaker.CircuitBreakerListener):
    """Updates Prometheus gauge on circuit breaker state changes."""

    def __init__(self, name: str):
        self.name = name

    def state_change(self, cb, old_state, new_state):
        state_value = {"closed": 0, "open": 1, "half-open": 2}.get(new_state.name, 0)
        CIRCUIT_BREAKER_STATE.labels(service=self.name).set(state_value)
        logger.info("Circuit breaker '%s': %s -> %s", self.name, old_state.name, new_state.name)


class AsyncHTTPClient:
    """
    Async HTTP client singleton with circuit breaker and metrics.

    Lifecycle:
        await AsyncHTTPClient.initialize()   # startup
        client = get_http_client()
        resp = await client.request("GET", url, service_name="db-service")
        await AsyncHTTPClient.close()        # shutdown
    """

    _instance: "AsyncHTTPClient | None" = None
    _httpx_client: httpx.AsyncClient | None = None
    _lock: asyncio.Lock = asyncio.Lock()
    _initialized: bool = False
    _circuit_breakers: dict[str, pybreaker.CircuitBreaker] = {}
    _config: HTTPClientConfig = default_config

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    async def initialize(cls, config: HTTPClientConfig | None = None) -> None:
        """Initialize the shared httpx pool. Call once at startup."""
        async with cls._lock:
            if cls._initialized:
                logger.warning("HTTP client already initialized, skipping")
                return

            cls._config = config or default_config
            cls._httpx_client = httpx.AsyncClient(
                timeout=httpx.Timeout(
                    timeout=cls._config.timeout,
                    connect=cls._config.connect_timeout,
                ),
                limits=httpx.Limits(
                    max_connections=cls._config.max_connections,
                    max_keepalive_connections=cls._config.max_keepalive,
                    keepalive_expiry=cls._config.keepalive_expiry,
                ),
                headers={
                    "User-Agent": "AccelerateAgenticService/1.0",
                    "Accept": "application/json",
                },
                follow_redirects=True,
            )
            cls._initialized = True
            logger.info(
                "HTTP client initialized: timeout=%ss, max_connections=%d",
                cls._config.timeout,
                cls._config.max_connections,
            )

    @classmethod
    def get_client(cls) -> "AsyncHTTPClient":
        if not cls._initialized or cls._httpx_client is None:
            raise RuntimeError(
                "HTTP client not initialized. Call 'await AsyncHTTPClient.initialize()' first."
            )
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    async def close(cls) -> None:
        async with cls._lock:
            if cls._httpx_client:
                await cls._httpx_client.aclose()
                cls._httpx_client = None
                cls._circuit_breakers = {}
                cls._initialized = False
                logger.info("HTTP client closed")

    @classmethod
    def is_initialized(cls) -> bool:
        return cls._initialized

    @classmethod
    @asynccontextmanager
    async def lifespan(cls, config: HTTPClientConfig | None = None):
        """Context manager for FastAPI lifespan."""
        await cls.initialize(config)
        try:
            yield
        finally:
            await cls.close()

    # -- helpers --

    def _get_circuit_breaker(self, service_name: str) -> pybreaker.CircuitBreaker | None:
        if not self._config.circuit_breaker.enabled:
            return None
        if service_name not in self._circuit_breakers:
            cb_cfg = self._config.circuit_breaker
            self._circuit_breakers[service_name] = pybreaker.CircuitBreaker(
                fail_max=cb_cfg.failure_threshold,
                reset_timeout=cb_cfg.recovery_timeout,
                listeners=[_CircuitBreakerListener(service_name)],
                name=service_name,
            )
            CIRCUIT_BREAKER_STATE.labels(service=service_name).set(0)
        return self._circuit_breakers[service_name]

    def _get_retry_delay(self, attempt: int, response_headers: dict[str, str] | None = None) -> float:
        retry_cfg = self._config.retry
        if response_headers:
            retry_after = response_headers.get("Retry-After") or response_headers.get("retry-after")
            if retry_after:
                try:
                    return float(retry_after)
                except ValueError:
                    pass
        delay = min(retry_cfg.base_delay * (2 ** attempt), retry_cfg.max_delay)
        jitter = delay * retry_cfg.jitter_factor * (2 * random.random() - 1)
        return max(0, delay + jitter)

    async def _call_with_circuit_breaker(
        self,
        circuit_breaker: pybreaker.CircuitBreaker,
        func: Callable,
    ):
        """Wrap pybreaker's sync call() for async functions."""
        # Use pybreaker's calling() context manager which handles
        # before_call, on_success, and on_failure correctly.
        with circuit_breaker.calling():
            return await func()

    # -- core request --

    async def request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
        service_name: str = "unknown",
        retry_attempts: int | None = None,
        retry_on_status: list[int] | None = None,
    ) -> dict[str, Any]:
        """
        Make an HTTP request with retry, circuit breaker, metrics, and structured logging.

        Returns: {"status_code": int, "headers": dict, "body": dict|str, "elapsed_ms": float}
        """
        method = method.upper()
        retry_cfg = self._config.retry
        max_attempts = retry_attempts if retry_attempts is not None else retry_cfg.max_attempts
        retry_statuses = retry_on_status if retry_on_status is not None else retry_cfg.retry_on_status
        circuit_breaker = self._get_circuit_breaker(service_name)

        request_headers = dict(headers or {})
        last_error: Exception | None = None

        for attempt in range(max_attempts):
            try:
                return await self._execute_request(
                    method=method, url=url, params=params, json=json, data=data,
                    headers=request_headers, timeout=timeout, service=service_name,
                    circuit_breaker=circuit_breaker,
                )
            except HTTPStatusError as e:
                if e.status_code in retry_statuses and attempt < max_attempts - 1:
                    wait = self._get_retry_delay(attempt, e.response_headers)
                    logger.warning(
                        "Retrying %s %s: HTTP %d (attempt %d/%d, backoff %.1fs)",
                        method, url, e.status_code, attempt + 1, max_attempts, wait,
                    )
                    last_error = e
                    await asyncio.sleep(wait)
                    continue
                raise
            except RequestTimeout as e:
                if not retry_cfg.retry_on_timeout or attempt >= max_attempts - 1:
                    raise
                last_error = e
                wait = self._get_retry_delay(attempt)
                logger.warning(
                    "Retrying %s %s: timeout (attempt %d/%d, backoff %.1fs)",
                    method, url, attempt + 1, max_attempts, wait,
                )
                await asyncio.sleep(wait)
            except ConnectionError as e:
                if not retry_cfg.retry_on_connection_error or attempt >= max_attempts - 1:
                    raise
                last_error = e
                wait = self._get_retry_delay(attempt)
                logger.warning(
                    "Retrying %s %s: connection error (attempt %d/%d, backoff %.1fs)",
                    method, url, attempt + 1, max_attempts, wait,
                )
                await asyncio.sleep(wait)
            except CircuitBreakerOpen:
                raise

        if last_error:
            raise RetryExhausted(url=url, attempts=max_attempts, last_error=last_error, service_name=service_name)
        raise HTTPClientError(message=f"Request failed after {max_attempts} attempts", service_name=service_name, url=url)

    async def _execute_request(
        self,
        method: str,
        url: str,
        params: dict[str, Any] | None,
        json: Any | None,
        data: dict[str, Any] | None,
        headers: dict[str, str],
        timeout: float | None,
        service: str,
        circuit_breaker: pybreaker.CircuitBreaker | None,
    ) -> dict[str, Any]:
        start_time = time.perf_counter()

        async def do_request() -> dict[str, Any]:
            try:
                response = await self._httpx_client.request(
                    method=method, url=url, params=params, json=json, data=data,
                    headers=headers, timeout=timeout,
                )
            except httpx.TimeoutException:
                raise RequestTimeout(url=url, timeout=timeout or self._config.timeout, service_name=service)
            except httpx.ConnectError as e:
                raise ConnectionError(url=url, original_error=e, service_name=service)

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            HTTP_REQUESTS_TOTAL.labels(service=service, method=method, status_code=str(response.status_code)).inc()
            HTTP_REQUEST_DURATION.labels(service=service, method=method).observe(elapsed_ms / 1000)

            log_level = logging.DEBUG if response.status_code == 404 else logging.INFO
            logger.log(
                log_level,
                "HTTP %s %s -> %d (%.0fms) [service=%s]",
                method, url, response.status_code, elapsed_ms, service,
            )

            result: dict[str, Any] = {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "elapsed_ms": elapsed_ms,
            }
            try:
                result["body"] = response.json()
            except Exception:
                result["body"] = response.text

            if response.status_code >= 400:
                HTTP_ERRORS_TOTAL.labels(service=service, error_type=f"HTTP{response.status_code}").inc()
                raise HTTPStatusError(
                    url=url,
                    status_code=response.status_code,
                    response_body=response.text,
                    response_headers=dict(response.headers),
                    service_name=service,
                )

            return result

        try:
            if circuit_breaker:
                try:
                    result = await self._call_with_circuit_breaker(circuit_breaker, do_request)
                except pybreaker.CircuitBreakerError:
                    HTTP_ERRORS_TOTAL.labels(service=service, error_type="CircuitBreakerOpen").inc()
                    raise CircuitBreakerOpen(
                        service_name=service,
                        reset_timeout=self._config.circuit_breaker.recovery_timeout,
                        failure_count=circuit_breaker.fail_counter,
                    )
            else:
                result = await do_request()

            return result

        except (RequestTimeout, ConnectionError) as e:
            HTTP_ERRORS_TOTAL.labels(service=service, error_type=type(e).__name__).inc()
            raise

    # -- HTTP method shortcuts --

    async def get(self, url: str, **kwargs) -> dict[str, Any]:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs) -> dict[str, Any]:
        return await self.request("POST", url, **kwargs)

    async def put(self, url: str, **kwargs) -> dict[str, Any]:
        return await self.request("PUT", url, **kwargs)

    async def patch(self, url: str, **kwargs) -> dict[str, Any]:
        return await self.request("PATCH", url, **kwargs)

    async def delete(self, url: str, **kwargs) -> dict[str, Any]:
        return await self.request("DELETE", url, **kwargs)

    def get_circuit_breaker_status(self) -> dict[str, Any]:
        return {
            name: {
                "state": cb.current_state,
                "fail_counter": cb.fail_counter,
                "failure_threshold": cb.fail_max,
                "recovery_timeout": cb.reset_timeout,
            }
            for name, cb in self._circuit_breakers.items()
        }


def get_http_client() -> AsyncHTTPClient:
    """Get the shared HTTP client instance."""
    return AsyncHTTPClient.get_client()

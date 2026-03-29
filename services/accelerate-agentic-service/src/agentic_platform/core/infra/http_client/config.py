"""
HTTP Client Configuration.

Global defaults -> per-service overrides -> per-request overrides.
All settings read from the centralized Pydantic Settings (config.py).
"""

from dataclasses import dataclass, field

from src.agentic_platform.core.config import settings


@dataclass
class RetryConfig:
    """Retry with exponential backoff configuration."""
    max_attempts: int = settings.http_retry_max_attempts
    base_delay: float = settings.http_retry_base_delay
    max_delay: float = settings.http_retry_max_delay
    jitter_factor: float = settings.http_retry_jitter
    retry_on_status: list[int] = field(default_factory=lambda: [408, 429, 500, 502, 503, 504])
    retry_on_timeout: bool = True
    retry_on_connection_error: bool = True


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration (per-service instances via pybreaker)."""
    enabled: bool = settings.http_cb_enabled
    failure_threshold: int = settings.http_cb_failure_threshold
    recovery_timeout: float = settings.http_cb_recovery_timeout


@dataclass
class HTTPClientConfig:
    """Complete HTTP client configuration."""
    timeout: float = settings.http_client_timeout
    connect_timeout: float = settings.http_client_connect_timeout
    max_connections: int = settings.http_client_max_connections
    max_keepalive: int = settings.http_client_max_keepalive
    keepalive_expiry: float = settings.http_client_keepalive_expiry
    retry: RetryConfig = field(default_factory=RetryConfig)
    circuit_breaker: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)


default_config = HTTPClientConfig()

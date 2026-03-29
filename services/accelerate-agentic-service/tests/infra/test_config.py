"""Tests for HTTP client configuration."""

from src.agentic_platform.core.infra.http_client.config import (
    CircuitBreakerConfig,
    HTTPClientConfig,
    RetryConfig,
    default_config,
)


class TestRetryConfig:
    def test_defaults(self):
        cfg = RetryConfig()
        assert cfg.max_attempts == 3
        assert cfg.base_delay == 1.0
        assert cfg.max_delay == 30.0
        assert cfg.jitter_factor == 0.25
        assert 429 in cfg.retry_on_status
        assert 503 in cfg.retry_on_status
        assert cfg.retry_on_timeout is True
        assert cfg.retry_on_connection_error is True

    def test_custom_values(self):
        cfg = RetryConfig(max_attempts=5, base_delay=2.0, retry_on_status=[500])
        assert cfg.max_attempts == 5
        assert cfg.base_delay == 2.0
        assert cfg.retry_on_status == [500]


class TestCircuitBreakerConfig:
    def test_defaults(self):
        cfg = CircuitBreakerConfig()
        assert cfg.enabled is True
        assert cfg.failure_threshold == 5
        assert cfg.recovery_timeout == 30.0

    def test_custom_values(self):
        cfg = CircuitBreakerConfig(enabled=False, failure_threshold=10)
        assert cfg.enabled is False
        assert cfg.failure_threshold == 10


class TestHTTPClientConfig:
    def test_defaults(self):
        cfg = HTTPClientConfig()
        assert cfg.timeout == 30
        assert cfg.connect_timeout == 10
        assert cfg.max_connections == 100
        assert cfg.max_keepalive == 20
        assert isinstance(cfg.retry, RetryConfig)
        assert isinstance(cfg.circuit_breaker, CircuitBreakerConfig)

    def test_default_config_instance(self):
        assert isinstance(default_config, HTTPClientConfig)

    def test_nested_override(self):
        cfg = HTTPClientConfig(
            timeout=60,
            retry=RetryConfig(max_attempts=10),
            circuit_breaker=CircuitBreakerConfig(enabled=False),
        )
        assert cfg.timeout == 60
        assert cfg.retry.max_attempts == 10
        assert cfg.circuit_breaker.enabled is False

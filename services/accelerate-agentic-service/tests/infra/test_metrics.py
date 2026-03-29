"""Tests for Prometheus metrics with graceful degradation."""

from src.agentic_platform.core.infra.http_client.metrics import (
    CIRCUIT_BREAKER_STATE,
    HTTP_ERRORS_TOTAL,
    HTTP_REQUEST_DURATION,
    HTTP_REQUESTS_TOTAL,
    PROMETHEUS_AVAILABLE,
)


class TestMetrics:
    def test_prometheus_is_available(self):
        # prometheus_client is installed in our test env
        assert PROMETHEUS_AVAILABLE is True

    def test_counters_can_be_labeled_and_incremented(self):
        HTTP_REQUESTS_TOTAL.labels(service="test", method="GET", status_code="200").inc()
        HTTP_ERRORS_TOTAL.labels(service="test", error_type="timeout").inc()

    def test_histogram_can_observe(self):
        HTTP_REQUEST_DURATION.labels(service="test", method="GET").observe(0.1)

    def test_gauge_can_set(self):
        CIRCUIT_BREAKER_STATE.labels(service="test").set(0)

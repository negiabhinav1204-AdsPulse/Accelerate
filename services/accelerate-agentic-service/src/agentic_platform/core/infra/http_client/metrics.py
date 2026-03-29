"""
Prometheus metrics with graceful degradation.

If prometheus_client is not installed, provides no-op stubs.
"""

try:
    from prometheus_client import Counter, Histogram, Gauge

    HTTP_REQUESTS_TOTAL = Counter(
        "http_client_requests_total",
        "Total HTTP requests",
        ["service", "method", "status_code"],
    )

    HTTP_REQUEST_DURATION = Histogram(
        "http_client_duration_seconds",
        "HTTP request duration in seconds",
        ["service", "method"],
        buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
    )

    HTTP_ERRORS_TOTAL = Counter(
        "http_client_errors_total",
        "Total HTTP client errors",
        ["service", "error_type"],
    )

    CIRCUIT_BREAKER_STATE = Gauge(
        "http_client_circuit_breaker_state",
        "Circuit breaker state (0=closed, 1=open, 2=half_open)",
        ["service"],
    )

    PROMETHEUS_AVAILABLE = True

except ImportError:

    class _NoOpLabeled:
        def labels(self, **kwargs):
            return self

        def inc(self, amount=1):
            pass

        def observe(self, value):
            pass

        def set(self, value):
            pass

    HTTP_REQUESTS_TOTAL = _NoOpLabeled()
    HTTP_REQUEST_DURATION = _NoOpLabeled()
    HTTP_ERRORS_TOTAL = _NoOpLabeled()
    CIRCUIT_BREAKER_STATE = _NoOpLabeled()

    PROMETHEUS_AVAILABLE = False

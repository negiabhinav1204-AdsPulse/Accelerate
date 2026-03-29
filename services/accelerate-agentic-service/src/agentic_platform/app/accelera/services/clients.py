"""Pre-built ServiceClient instances for each Accelerate downstream microservice.

All HTTP calls from Accelera AI tools go through these clients.
ServiceClient provides: retry, circuit breaker, Prometheus metrics, auth forwarding.
"""

from src.agentic_platform.core.config import settings
from src.agentic_platform.core.infra.http_client import ServiceClient

# ── Downstream service clients ────────────────────────────────────────────────

commerce_client = ServiceClient(
    "commerce-service",
    base_url=settings.commerce_service_url,
)

reporting_client = ServiceClient(
    "reporting-service",
    base_url=settings.reporting_service_url,
)

memory_client = ServiceClient(
    "memory-service",
    base_url=settings.memory_service_url,
)

connector_client = ServiceClient(
    "connector-service",
    base_url=settings.connector_service_url,
)

shopping_feeds_client = ServiceClient(
    "shopping-feeds-service",
    base_url=settings.shopping_feeds_service_url,
)

cdp_client = ServiceClient(
    "cdp-service",
    base_url=settings.cdp_service_url,
)

campaigns_client = ServiceClient(
    "campaigns-service",
    base_url=settings.campaigns_service_url,
)

creative_client = ServiceClient(
    "creative-service",
    base_url=settings.creative_service_url,
)

agent_client = ServiceClient(
    "agent-service",
    base_url=settings.agent_service_url,
)

personalization_client = ServiceClient(
    "personalization-service",
    base_url=settings.personalization_service_url,
)

leads_client = ServiceClient(
    "leads-service",
    base_url=settings.leads_service_url,
)

analytics_client = ServiceClient(
    "analytics-service",
    base_url=settings.analytics_service_url,
)

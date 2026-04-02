"""Per-request context hydration for the campaign agent.

Called once per request before the graph runs. Fetches connected
ad platforms from the campaign service and builds a CampaignContext
— the single source of truth for the request lifecycle.
"""

import logging

logger = logging.getLogger(__name__)


async def hydrate_campaign_context(user) -> None:
    """Fetch connected ad platforms and build CampaignContext."""
    if user.domain_context.get("campaign_context"):
        return  # already hydrated

    from src.agentic_platform.core.config import settings
    from src.agentic_platform.app.campaigns.models import CampaignContext, ConnectedPlatform

    if settings.local_override_mock_supported_campaigns:
        # Inject fake connected platforms from .env for local development
        tz = settings.local_dev_platform_timezone
        all_conn = [
            ConnectedPlatform(
                platform="GOOGLE", account_id=settings.local_dev_google_account_id,
                customer_id=settings.local_dev_google_customer_id,
                currency=settings.local_dev_google_currency,
                account_name=settings.local_dev_google_account_name, timezone=tz,
            ),
            ConnectedPlatform(
                platform="META", account_id=settings.local_dev_bing_account_id,
                customer_id=settings.local_dev_bing_customer_id,
                currency=settings.local_dev_bing_currency,
                account_name=settings.local_dev_bing_account_name, timezone=tz,
            ),
        ]
        supported_conn = list(all_conn)
        logger.info("Local dev mode: injected %d fake connected platforms", len(supported_conn))
    else:
        try:
            from src.agentic_platform.app.campaigns.services import campaign_client
            from src.agentic_platform.app.campaigns.platform_matrix import (
                extract_all_connections,
                filter_connected_platforms,
            )
            connections = await campaign_client.get_connections(user.org_id)
            all_conn = extract_all_connections(connections)
            supported_conn = filter_connected_platforms(connections)
        except Exception as e:
            logger.warning("Failed to fetch connected platforms for org %s: %s", user.org_id, e)
            all_conn = []
            supported_conn = []

    ctx = CampaignContext(
        org_id=user.org_id,
        user_id=user.user_id,
        email=user.email,
        all_connections=all_conn,
        supported_connections=supported_conn,
    )
    user.domain_context["campaign_context"] = ctx
    # Backward compat: WorkflowContext.connected_platforms reads this from metadata
    user.domain_context["connected_platforms"] = supported_conn

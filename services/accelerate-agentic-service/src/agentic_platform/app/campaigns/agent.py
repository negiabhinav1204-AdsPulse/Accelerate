"""Campaign assistant agent configuration.

This file is the single source of truth for the campaign agent:
prompt, tools, model, and database config. The platform discovers
it via app/__init__.py → loader.py and compiles it at startup.
"""

from src.agentic_platform.core.agents.config import AgentConfig
from src.agentic_platform.core.config import settings
from src.agentic_platform.app.campaigns.context import hydrate_campaign_context
from src.agentic_platform.app.campaigns.prompts.system import SYSTEM_PROMPT, campaign_dynamic_context
from src.agentic_platform.app.campaigns.workflows.create_campaign import create_media_plan
from src.agentic_platform.app.common.tools.image_gen import generate_image
from src.agentic_platform.app.common.mcp_servers import mcp_servers

# Accelerate proxy tools — 38 data tools proxied from the Next.js dashboard
from src.agentic_platform.app.campaigns.tools.accelerate_analytics import ACCELERATE_ANALYTICS_TOOLS
from src.agentic_platform.app.campaigns.tools.accelerate_ecommerce import ACCELERATE_ECOMMERCE_TOOLS
from src.agentic_platform.app.campaigns.tools.accelerate_campaigns import ACCELERATE_CAMPAIGN_TOOLS
from src.agentic_platform.app.campaigns.tools.accelerate_audiences import ACCELERATE_AUDIENCE_TOOLS
from src.agentic_platform.app.campaigns.tools.accelerate_platform import ACCELERATE_PLATFORM_TOOLS

config = AgentConfig(
    agent_id="campaign-assistant",
    name="Campaign Assistant",
    system_prompt=SYSTEM_PROMPT,
    dynamic_context=campaign_dynamic_context,
    hydrate_context=hydrate_campaign_context,
    model=settings.campaign_agent_model,
    tools=[
        generate_image,
        *ACCELERATE_ANALYTICS_TOOLS,
        *ACCELERATE_ECOMMERCE_TOOLS,
        *ACCELERATE_CAMPAIGN_TOOLS,
        *ACCELERATE_AUDIENCE_TOOLS,
        *ACCELERATE_PLATFORM_TOOLS,
    ],
    workflows=[create_media_plan],
    checkpointer_db_url=settings.campaign_checkpointer_db_url or settings.checkpointer_db_url,
    db_service_url=settings.campaign_db_service_url or settings.db_service_url,
    langfuse_trace_name="campaign-chat-agent",
    mcp_servers=mcp_servers("bigquery_analytics"),
)

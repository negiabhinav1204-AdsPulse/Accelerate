"""Campaign creation workflow — 5-step AgenticWorkflow with HITL review.

Flow:
  scrape → analyze (7 parallel agents) → [HITL: configure] → build → publish

The HITL step pauses after analysis so the user can review/edit AI recommendations
before any assets are generated or campaigns published.
"""

from langchain_core.tools import tool

from src.agentic_platform.core.engine import (
    AgenticWorkflow, Step, SubStep, NodeResponse, WorkflowContext,
)
from src.agentic_platform.app.accelera.workflows.steps.scrape import scrape
from src.agentic_platform.app.accelera.workflows.steps.analyze import analyze
from src.agentic_platform.app.accelera.workflows.steps.configure import configure
from src.agentic_platform.app.accelera.workflows.steps.build import build
from src.agentic_platform.app.accelera.workflows.steps.publish import publish


@tool("create_campaign")
async def _create_campaign(
    url: str,
    budget: float,
    goal: str = "SALES",
    start_date: str = "",
    end_date: str = "",
    platform_selections: list = None,
) -> dict:
    """Create a full advertising campaign from a website URL.

    Use when the user pastes a URL, says they want to create a campaign,
    advertise their store/product, or launch ads. This runs a complete
    AI-powered workflow: website analysis → strategy → user review → asset
    generation → publishing to connected ad platforms.

    Args:
        url: The website or product URL to create a campaign for.
        budget: Total campaign budget in USD.
        goal: Campaign objective — SALES, LEADS, WEBSITE_TRAFFIC, or BRAND_AWARENESS.
        start_date: Campaign start date (YYYY-MM-DD). Defaults to today.
        end_date: Campaign end date (YYYY-MM-DD). Optional.
        platform_selections: Platforms to advertise on. Defaults to all connected.
    """
    raise NotImplementedError  # Framework routes to workflow sub-graph


create_campaign_workflow = AgenticWorkflow(
    trigger=_create_campaign,
    title="Creating campaign for {url}",
    steps=[
        Step(
            name="scrape",
            func=scrape,
            label="Analyzing website",
            timeout=30,
            thinking_messages=["Scraping website content...", "Extracting product information..."],
        ),
        Step(
            name="analyze",
            func=analyze,
            label="Building strategy",
            timeout=90,
            substeps=[
                SubStep("brand", "Brand analysis"),
                SubStep("lpu", "Landing page analysis"),
                SubStep("competitor", "Competitor research"),
                SubStep("intent", "Intent mapping"),
                SubStep("creative", "Creative strategy"),
                SubStep("budget", "Budget modeling"),
                SubStep("strategy", "Media plan"),
            ],
            thinking_messages=["Running market analysis...", "Researching competitors...", "Building strategy..."],
        ),
        Step(
            name="configure",
            func=configure,
            label="Review settings",
            hidden=True,             # Hidden — HITL form appears directly in chat
            timeout=600,             # 10 min for user to fill the form
        ),
        Step(
            name="build",
            func=build,
            label="Generating assets",
            timeout=120,
            substeps=[
                SubStep("text", "Writing ad copy"),
                SubStep("images", "Generating creatives"),
            ],
            thinking_messages=["Writing ad copy...", "Generating images..."],
        ),
        Step(
            name="publish",
            func=publish,
            label="Publishing campaigns",
            timeout=60,
            thinking_messages=["Publishing to ad platforms...", "Creating campaigns..."],
        ),
    ],
)

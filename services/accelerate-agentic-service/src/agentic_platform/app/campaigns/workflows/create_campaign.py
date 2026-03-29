"""Campaign creation workflow — optimized for speed.

scrape (~5s) → configure (HITL form) → analyze (~10s, 4 agents on Haiku) → plan (~8s, GPT-5.x) → build+save (~30-35s parallel)
Target total: ~55-60s (+ user time on HITL form)

Key optimizations vs v2 port:
- GPT-5.x for plan + text gen (fast structured output, fewer validation failures)
- Gemini for images (~5-8s vs OpenAI ~20-30s)
- Media plan API call runs in parallel with campaign building
- max_tokens 16000 to prevent truncation on complex schemas
"""

from langchain_core.tools import tool

from src.agentic_platform.core.engine.workflow import AgenticWorkflow, Step, SubStep
from src.agentic_platform.app.campaigns.models.workflow_io import CreateMediaPlanInput
from src.agentic_platform.app.campaigns.workflows.steps import (
    scrape, analyze, configure, plan, build, save,
)


# ── Trigger ───────────────────────────────────────────────────────

@tool("create_media_plan", args_schema=CreateMediaPlanInput)
async def _create_media_plan(
    url: str,
    platform_selections: dict = None,
    total_budget: float = 0,
    start_date: str = "",
    end_date: str = "",
    goal: str = "",
) -> dict:
    """Create a media plan with advertising campaigns from a website URL.
    Only the URL is required — everything else is auto-detected or collected
    from the user via an interactive form."""
    raise NotImplementedError("Routed to workflow sub-graph")


# ── Workflow ──────────────────────────────────────────────────────

create_media_plan = AgenticWorkflow(
    trigger=_create_media_plan,
    title="Creating media plan for {url}",
    steps=[
        Step("scrape", scrape, label="Research website", timeout=120,
             thinking_messages=["Analyzing website..."]),
        Step("analyze", analyze, label="Analyze market", timeout=120,
             thinking_messages=["Running market analysis..."],
             substeps=[
                 SubStep("business", "Business context + trends"),
                 SubStep("brand", "Brand + competitors"),
                 SubStep("products", "Products"),
                 SubStep("audience", "Audience personas"),
             ]),
        Step("configure", configure, label="Configure campaign", timeout=600,
             thinking_messages=["Preparing campaign settings..."], hidden=True),
        Step("plan", plan, label="Plan campaigns", timeout=120,
             thinking_messages=["Designing campaign strategy..."],
             substeps=[
                 SubStep("connections", "Connected platforms"),
                 SubStep("strategy", "Campaign strategy"),
             ]),
        Step("build", build, label="Build campaigns", timeout=300,
             thinking_messages=["Generating ads and images..."],
             substeps=[
                 SubStep("text", "Ad copy"),
                 SubStep("images", "Images"),
                 SubStep("keywords", "Keywords"),
                 SubStep("logos", "Logo"),
             ]),
        Step("save", save, label="Save campaigns", timeout=120,
             thinking_messages=["Saving to platforms..."]),
    ],
)

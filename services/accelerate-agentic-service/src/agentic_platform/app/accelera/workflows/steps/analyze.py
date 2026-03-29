"""Step 2: Run 7 parallel LLM agents to analyze brand, landing page, competition, intent, creative, budget, and strategy."""

import asyncio
import json
import logging
from typing import Any

from src.agentic_platform.core.engine import NodeResponse, WorkflowContext, StepArtifact
from src.agentic_platform.core.llm import structured_llm_call, get_llm
from src.agentic_platform.app.accelera.prompts.agents.brand import BRAND_PROMPT
from src.agentic_platform.app.accelera.prompts.agents.lpu import LPU_PROMPT
from src.agentic_platform.app.accelera.prompts.agents.competitor import COMPETITOR_PROMPT
from src.agentic_platform.app.accelera.prompts.agents.intent import INTENT_PROMPT
from src.agentic_platform.app.accelera.prompts.agents.creative import CREATIVE_PROMPT
from src.agentic_platform.app.accelera.prompts.agents.budget import BUDGET_PROMPT
from src.agentic_platform.app.accelera.prompts.agents.strategy import STRATEGY_PROMPT

logger = logging.getLogger(__name__)


async def _run_agent(name: str, prompt: str, user_content: str, model: str = "haiku") -> dict:
    """Run a single LLM agent and parse JSON output."""
    try:
        result = await structured_llm_call(
            system_prompt=prompt,
            user_message=user_content,
            model=model,
        )
        if isinstance(result, str):
            return json.loads(result)
        return result if isinstance(result, dict) else {}
    except Exception as e:
        logger.warning("Agent '%s' failed: %s", name, e)
        return {"error": str(e)}


async def analyze(ctx: WorkflowContext) -> NodeResponse:
    """Run all 7 analysis agents in parallel using asyncio.gather."""
    scrape_data = ctx.results.get("scrape", NodeResponse(summary="", data={})).data
    page_content = scrape_data.get("page_content", "")
    url = scrape_data.get("url", ctx.args.get("url", ""))
    budget = ctx.args.get("budget", 1000)

    ctx.progress.start("brand")
    ctx.progress.start("lpu")
    ctx.progress.start("competitor")

    # Phase 1: brand, lpu, competitor in parallel
    brand_out, lpu_out, competitor_out = await asyncio.gather(
        _run_agent("brand", BRAND_PROMPT, f"URL: {url}\n\nContent:\n{page_content}"),
        _run_agent("lpu", LPU_PROMPT, f"URL: {url}\n\nContent:\n{page_content}"),
        _run_agent("competitor", COMPETITOR_PROMPT, f"URL: {url}\n\nContent:\n{page_content}"),
    )

    ctx.progress.done("brand", summary=f"Brand: {brand_out.get('brand_name', 'analyzed')}")
    ctx.progress.done("lpu", summary=f"LPU: {lpu_out.get('conversion_goal', 'analyzed')}")
    ctx.progress.done("competitor", summary=f"Market: {competitor_out.get('market_saturation', 'analyzed')}")

    # Phase 2: intent (needs brand + lpu)
    ctx.progress.start("intent")
    intent_context = f"Brand Analysis:\n{json.dumps(brand_out)}\n\nLanding Page Analysis:\n{json.dumps(lpu_out)}"
    intent_out = await _run_agent("intent", INTENT_PROMPT, intent_context)
    ctx.progress.done("intent", summary=f"Intent: {intent_out.get('primary_intent', 'analyzed')}")

    # Phase 3: creative (needs brand + lpu + intent + competitor)
    ctx.progress.start("creative")
    creative_context = (
        f"Brand:\n{json.dumps(brand_out)}\n\n"
        f"Landing Page:\n{json.dumps(lpu_out)}\n\n"
        f"Intent:\n{json.dumps(intent_out)}\n\n"
        f"Competitive Landscape:\n{json.dumps(competitor_out)}"
    )
    creative_out = await _run_agent("creative", CREATIVE_PROMPT, creative_context)
    ctx.progress.done("creative", summary=f"Angle: {creative_out.get('ad_angle', 'analyzed')}")

    # Phase 4: budget + strategy in parallel (both need full context)
    ctx.progress.start("budget")
    ctx.progress.start("strategy")
    budget_context = f"Total Budget: ${budget}\n\nBrand:\n{json.dumps(brand_out)}\n\nIntent:\n{json.dumps(intent_out)}"
    strategy_context = (
        f"Brand:\n{json.dumps(brand_out)}\n\nLanding Page:\n{json.dumps(lpu_out)}\n\n"
        f"Intent:\n{json.dumps(intent_out)}\n\nCompetitor:\n{json.dumps(competitor_out)}\n\n"
        f"Creative:\n{json.dumps(creative_out)}\n\nBudget: ${budget}"
    )

    budget_out, strategy_out = await asyncio.gather(
        _run_agent("budget", BUDGET_PROMPT, budget_context),
        _run_agent("strategy", STRATEGY_PROMPT, strategy_context, model="gpt-pro"),
    )
    ctx.progress.done("budget", summary=f"Recommended: ${budget_out.get('recommended_budget', budget):,.0f}")
    ctx.progress.done("strategy", summary=f"Strategy: {strategy_out.get('objective', 'complete')}")

    # Emit brand profile + competitor intel as sidebar artifacts
    ctx.emit_artifact(StepArtifact(
        type="brand_context",
        title=f"Brand: {brand_out.get('brand_name', 'Analysis')}",
        data=brand_out,
    ))
    ctx.emit_artifact(StepArtifact(
        type="competitor_context",
        title="Competitive Landscape",
        data=competitor_out,
    ))

    all_data = {
        "brand": brand_out,
        "lpu": lpu_out,
        "competitor": competitor_out,
        "intent": intent_out,
        "creative": creative_out,
        "budget": budget_out,
        "strategy": strategy_out,
    }

    return NodeResponse(
        summary=f"Analysis complete: {strategy_out.get('objective','campaign')} strategy for {brand_out.get('brand_name', url)}.",
        data=all_data,
    )

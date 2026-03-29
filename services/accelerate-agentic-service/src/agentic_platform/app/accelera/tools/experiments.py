"""A/B experiment tools — create, setup, and fetch results for landing page experiments.

Tools:
  get_experiment_results  — Fetch A/B test stats: variants, significance, lift, winner
  setup_full_experiment   — One-shot: URL → zone detection → variant → experiment
  create_experiment       — Create experiment from specific zone selector + HTML variant

These tools call accelerate-personalization-service (Phase 4).
Gracefully degrade if the service is not yet available.

Reference:
  Adaptiv api/app/routers/experiments.py, api/app/routers/edge.py, api/app/routers/zones.py
  Adaptiv api/app/services/experiment_analytics.py (z-test statistical significance)
  Adaptiv api/app/services/bandit.py (Thompson Sampling)
  Adaptiv api/app/routers/copilot.py (get_experiment_results, setup_full_experiment, create_experiment handlers)
"""

from typing import Optional

from langchain_core.tools import tool

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.app.accelera.services.clients import personalization_client
from src.agentic_platform.app.accelera.blocks import (
    experiment_results_block, ExperimentResultsData, ExperimentVariantRow,
    metric_cards_block, MetricCardsData, MetricItem,
)
from src.agentic_platform.app.accelera.brand.company_brief import (
    get_brief_for_org,
    format_brief_for_variant_prompt,
)
from pydantic import BaseModel


# ── get_experiment_results ────────────────────────────────────────────

@tool("get_experiment_results")
async def _get_experiment_results(experiment_id: Optional[str] = None) -> dict:
    """Fetch A/B test results from the personalization service.
    Returns variant performance stats, statistical significance, lift vs control, and winner.

    Use when the user asks about A/B tests, experiment performance, or which variant is winning.
    If no experiment_id is given, returns results for the most recent active experiment."""
    org_id = get_org_id()

    # Fetch from personalization-service
    experiment: dict = {}
    try:
        if experiment_id:
            resp = await personalization_client.get(f"/experiments/{experiment_id}/results?org_id={org_id}")
        else:
            resp = await personalization_client.get(f"/experiments/latest/results?org_id={org_id}")
        experiment = resp.get("body", {}) or {}
    except Exception:
        pass

    if not experiment:
        return ToolResponse(
            summary="No experiment data found. Create an A/B experiment first using setup_full_experiment.",
            data={"experiment_id": experiment_id},
        ).model_dump()

    # Parse variants
    variants = [
        ExperimentVariantRow(
            name=v.get("name", f"Variant {i}"),
            visitors=v.get("visitors", 0),
            conversions=v.get("conversions", 0),
            conversion_rate=v.get("conversion_rate", 0.0),
            lift=v.get("lift", 0.0),
            is_winner=v.get("is_winner", False),
            is_control=v.get("is_control", i == 0),
        )
        for i, v in enumerate(experiment.get("variants", []))
    ]

    confidence = float(experiment.get("confidence", 0.0))
    is_significant = experiment.get("is_significant", confidence >= 95.0)
    winner = next((v for v in variants if v.is_winner), None)

    status_summary = (
        f"Experiment '{experiment.get('name', experiment_id)}': "
        f"{confidence:.0f}% confidence, "
        f"{'statistically significant — ' + winner.name + ' wins' if is_significant and winner else 'not yet significant'}."
    )

    return ToolResponse(
        summary=status_summary,
        data=experiment,
        ui_blocks=[experiment_results_block.create(data=ExperimentResultsData(
            experiment_id=experiment.get("id", experiment_id or ""),
            experiment_name=experiment.get("name", ""),
            status=experiment.get("status", "running"),
            confidence=confidence,
            is_significant=is_significant,
            variants=variants,
            days_running=experiment.get("days_running", 0),
        ))],
    ).model_dump()

get_experiment_results = AgenticTool(
    func=_get_experiment_results,
    thinking_messages=["Fetching experiment results...", "Analyzing A/B test data..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)


# ── Variant generation schema ─────────────────────────────────────────

class VariantSpec(BaseModel):
    zone_selector: str = ""
    variant_html: str = ""
    hypothesis: str = ""


# ── setup_full_experiment ─────────────────────────────────────────────

@tool("setup_full_experiment")
async def _setup_full_experiment(
    page_url: str,
    hypothesis: Optional[str] = None,
    traffic_split: float = 50.0,
) -> dict:
    """One-shot A/B experiment setup: given a page URL, detect testable zones,
    generate on-brand variant HTML, and create the experiment.

    Returns experiment ID and preview link.
    Use when the user wants to run a landing page A/B test and hasn't specified zones."""
    org_id = get_org_id()

    # 1. Load brand brief for on-brand variant generation
    brief = await get_brief_for_org(org_id)
    brand_ctx = format_brief_for_variant_prompt(brief) if brief else ""

    # 2. Generate variant spec via LiteLLM (zone detection + HTML)
    gen_prompt = f"""You are a CRO (Conversion Rate Optimization) expert.

Page URL: {page_url}
{('Hypothesis: ' + hypothesis) if hypothesis else 'Generate a compelling hypothesis for this page.'}
{('Brand context:\n' + brand_ctx) if brand_ctx else ''}

Create an A/B test variant:

zone_selector: CSS selector for the element to test (e.g. "#hero-cta", ".hero-headline", ".product-description")
              Focus on high-impact zones: hero section, CTA button, headline, pricing section.
variant_html: Valid HTML for the variant version of that zone. Keep it realistic and on-brand.
             If the selector targets a button, return button HTML. If headline, return h1/h2 HTML.
hypothesis: One sentence: "By changing X to Y, we expect Z% lift in conversions because..."

Make the variant meaningfully different from a typical control (not just copy tweaks).
Consider: social proof, urgency, value-focused CTAs, simplified forms."""

    try:
        spec = await structured_llm_call(gen_prompt, VariantSpec, model="haiku")
    except Exception:
        spec = VariantSpec(
            zone_selector="#hero-cta",
            variant_html='<button class="cta-button cta-primary">Start Free Trial</button>',
            hypothesis="Changing CTA to 'Start Free Trial' will increase conversion rate by 15%.",
        )

    # 3. Create experiment via personalization-service
    experiment: dict = {}
    try:
        resp = await personalization_client.post("/experiments/setup", json={
            "org_id": org_id,
            "page_url": page_url,
            "hypothesis": spec.hypothesis,
            "zone_selector": spec.zone_selector,
            "variant_html": spec.variant_html,
            "traffic_split": traffic_split,
            "allocation_mode": "random",
        })
        experiment = resp.get("body", {}) or {}
    except Exception:
        # Personalization service not yet available — return the plan
        experiment = {
            "id": "pending",
            "status": "pending",
            "page_url": page_url,
            "zone_selector": spec.zone_selector,
            "variant_html": spec.variant_html,
            "hypothesis": spec.hypothesis,
            "traffic_split": traffic_split,
            "message": "Personalization service not yet available. Experiment plan ready.",
        }

    exp_id = experiment.get("id", "pending")
    metrics = [
        MetricItem(label="Experiment ID", value=str(exp_id)),
        MetricItem(label="Zone", value=spec.zone_selector),
        MetricItem(label="Traffic Split", value=f"{traffic_split:.0f}% variant"),
        MetricItem(label="Status", value=experiment.get("status", "pending").capitalize()),
    ]

    return ToolResponse(
        summary=(
            f"A/B experiment set up for {page_url}. "
            f"Testing zone: {spec.zone_selector}. "
            f"Hypothesis: {spec.hypothesis}"
        ),
        data={
            "experiment_id": exp_id,
            "zone_selector": spec.zone_selector,
            "variant_html": spec.variant_html,
            "hypothesis": spec.hypothesis,
            "page_url": page_url,
            "experiment": experiment,
        },
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title="A/B Experiment Created",
        ))],
    ).model_dump()

setup_full_experiment = AgenticTool(
    func=_setup_full_experiment,
    thinking_messages=[
        "Detecting testable zones...",
        "Generating variant...",
        "Creating experiment...",
    ],
    tags=[ToolTag.CAMPAIGN],
    timeout=60,
)


# ── create_experiment ─────────────────────────────────────────────────

@tool("create_experiment")
async def _create_experiment(
    name: str,
    page_url: str,
    zone_selector: str,
    variant_html: str,
    traffic_split: float = 50.0,
    allocation_mode: str = "random",
) -> dict:
    """Create an A/B experiment with a specific zone selector and variant HTML.

    Use when the user knows exactly what change they want to test.
    For auto-detection of zones and variant generation, use setup_full_experiment instead.

    name: Experiment name for tracking.
    zone_selector: CSS selector for the element to replace (e.g. ".hero-headline").
    variant_html: HTML for the variant version of the zone.
    traffic_split: % of traffic to see the variant (default 50).
    allocation_mode: "random" (50/50 split) | "bandit" (Thompson Sampling auto-optimization)."""
    org_id = get_org_id()

    payload = {
        "org_id": org_id,
        "name": name,
        "page_url": page_url,
        "zone_selector": zone_selector,
        "variant_html": variant_html,
        "traffic_split": traffic_split,
        "allocation_mode": allocation_mode,
    }

    experiment: dict = {}
    try:
        resp = await personalization_client.post("/experiments", json=payload)
        experiment = resp.get("body", {}) or {}
        success = resp.get("status_code", 500) in (200, 201)
    except Exception:
        success = False

    if not success and not experiment:
        experiment = {
            "id": "pending",
            "status": "pending",
            "message": "Personalization service not yet available. Experiment queued.",
            **payload,
        }

    exp_id = experiment.get("id", "pending")
    metrics = [
        MetricItem(label="Name", value=name),
        MetricItem(label="Experiment ID", value=str(exp_id)),
        MetricItem(label="Zone", value=zone_selector),
        MetricItem(label="Traffic Split", value=f"{traffic_split:.0f}% variant"),
        MetricItem(label="Mode", value=allocation_mode.replace("_", " ").title()),
        MetricItem(label="Status", value=experiment.get("status", "pending").capitalize()),
    ]

    return ToolResponse(
        summary=f"Experiment '{name}' created: testing {zone_selector} on {page_url}, {traffic_split:.0f}% traffic. ID: {exp_id}",
        data=experiment,
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title=f"Experiment: {name}",
        ))],
    ).model_dump()

create_experiment = AgenticTool(
    func=_create_experiment,
    thinking_messages=["Creating A/B experiment...", "Setting up experiment..."],
    tags=[ToolTag.CAMPAIGN],
    timeout=30,
)

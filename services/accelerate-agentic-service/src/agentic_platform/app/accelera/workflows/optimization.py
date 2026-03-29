"""Campaign optimization workflow — 7 AI agents running in parallel, synthesized by CMO agent.

Flow:
  [Budget | Bid | Creative | Audience | Anomaly | Pacing] (parallel) → CMO Summary

Triggered from Accelera AI chat when user asks for optimization analysis.
The workflow streams progress to the chat and returns a full CMO summary.
"""

from langchain_core.tools import tool

from src.agentic_platform.core.engine import (
    AgenticWorkflow, Step, Parallel, NodeResponse, WorkflowContext,
)
from src.agentic_platform.app.accelera.workflows.steps.optimization.budget_agent import budget_agent
from src.agentic_platform.app.accelera.workflows.steps.optimization.bid_agent import bid_agent
from src.agentic_platform.app.accelera.workflows.steps.optimization.creative_agent import creative_agent
from src.agentic_platform.app.accelera.workflows.steps.optimization.audience_agent import audience_agent
from src.agentic_platform.app.accelera.workflows.steps.optimization.anomaly_agent import anomaly_agent
from src.agentic_platform.app.accelera.workflows.steps.optimization.pacing_agent import pacing_agent
from src.agentic_platform.app.accelera.workflows.steps.optimization.cmo_summary_agent import cmo_summary_agent


@tool("run_optimization_workflow")
async def _run_optimization_workflow(days: int = 30) -> dict:
    """Run the full 7-agent campaign optimization analysis.

    Triggers 6 specialized AI agents in parallel (Budget, Bid, Creative, Audience,
    Anomaly, Pacing), then synthesizes findings into a CMO-level executive summary
    with prioritized action list.

    Use when the user asks for:
    - Deep optimization analysis or 'run the optimization agents'
    - 'What should I optimize?' with full analysis context
    - Campaign health across all dimensions

    Returns a comprehensive optimization report with actionable recommendations.
    days: lookback window for analysis (default 30)"""
    raise NotImplementedError  # Framework routes to workflow sub-graph


optimization_workflow = AgenticWorkflow(
    trigger=_run_optimization_workflow,
    title="Running {days}-day campaign optimization analysis",
    steps=[
        Parallel(
            name="agents",
            label="Running optimization agents",
            steps=[
                Step(
                    name="budget",
                    func=budget_agent,
                    label="Budget analysis",
                    timeout=45,
                    thinking_messages=["Analyzing budget allocation...", "Finding reallocation opportunities..."],
                ),
                Step(
                    name="bid",
                    func=bid_agent,
                    label="Bid optimization",
                    timeout=45,
                    thinking_messages=["Analyzing bid efficiency...", "Finding CPC opportunities..."],
                ),
                Step(
                    name="creative",
                    func=creative_agent,
                    label="Creative health check",
                    timeout=45,
                    thinking_messages=["Checking creative fatigue...", "Analyzing CTR trends..."],
                ),
                Step(
                    name="audience",
                    func=audience_agent,
                    label="Audience analysis",
                    timeout=45,
                    thinking_messages=["Analyzing audience targeting...", "Finding expansion opportunities..."],
                ),
                Step(
                    name="anomaly",
                    func=anomaly_agent,
                    label="Anomaly detection",
                    timeout=45,
                    thinking_messages=["Scanning for anomalies...", "Checking metric trends..."],
                ),
                Step(
                    name="pacing",
                    func=pacing_agent,
                    label="Budget pacing",
                    timeout=45,
                    thinking_messages=["Analyzing spend pacing...", "Checking delivery rates..."],
                ),
            ],
        ),
        Step(
            name="cmo_summary",
            func=cmo_summary_agent,
            label="Synthesizing recommendations",
            timeout=60,
            thinking_messages=["Synthesizing agent findings...", "Building CMO report..."],
        ),
    ],
)

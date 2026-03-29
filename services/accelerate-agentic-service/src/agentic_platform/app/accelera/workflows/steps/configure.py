"""Step 3: HITL — pause and ask user to review campaign settings before generating assets."""

from src.agentic_platform.core.engine import (
    NodeResponse, WorkflowContext,
    HITLRequest, HITLField, HITLActionButton, HITLAction, is_rejection,
)


async def configure(ctx: WorkflowContext) -> NodeResponse:
    """Present a review form to the user. Workflow pauses here until the user approves."""
    analyze_data = ctx.results.get("analyze", NodeResponse(summary="", data={})).data
    budget_out = analyze_data.get("budget", {})
    strategy_out = analyze_data.get("strategy", {})

    recommended_budget = budget_out.get("recommended_budget") or ctx.args.get("budget", 1000)
    recommended_duration = budget_out.get("duration_days", 30)

    # Check if user already rejected via HITL (previous iteration)
    if "configure" in ctx.results:
        user_input = ctx.results["configure"].metadata.get("user_input", {})
        if is_rejection(user_input):
            return NodeResponse(
                summary="Campaign creation cancelled by user.",
                data={"cancelled": True},
            )

    # Determine which platforms are available based on connected accounts
    connected = ctx.connected_platforms or []
    connected_platform_names = list({
        (p.platform.lower() if hasattr(p, "platform") else p.get("platform", "").lower())
        for p in connected
    }) or ["google", "meta"]

    # Pre-select platforms from args or connected defaults
    selected_platforms = ctx.args.get("platform_selections") or connected_platform_names

    return NodeResponse(
        summary="Analysis complete. Review campaign settings before generating assets.",
        data=analyze_data,
        hitl=HITLRequest(
            type="form",
            title="Review Campaign Before Generating Assets",
            description=(
                f"AI has built a {strategy_out.get('objective','SALES')} strategy. "
                "Review and adjust the settings below before we generate ad copy and creatives."
            ),
            fields=[
                HITLField(
                    name="budget",
                    label="Total Campaign Budget (USD)",
                    type="number",
                    default=recommended_budget,
                    required=True,
                ),
                HITLField(
                    name="duration_days",
                    label="Campaign Duration (days)",
                    type="number",
                    default=recommended_duration,
                    required=True,
                ),
                HITLField(
                    name="start_date",
                    label="Start Date",
                    type="date",
                    default=ctx.args.get("start_date", ""),
                    required=True,
                ),
                HITLField(
                    name="goal",
                    label="Campaign Goal",
                    type="select",
                    options=["SALES", "LEADS", "WEBSITE_TRAFFIC", "BRAND_AWARENESS"],
                    default=ctx.args.get("goal") or strategy_out.get("objective", "SALES"),
                    required=True,
                ),
                HITLField(
                    name="platforms",
                    label="Platforms",
                    type="multiselect",
                    options=["google", "meta", "bing"],
                    default=selected_platforms,
                    required=True,
                ),
            ],
            actions=[
                HITLActionButton(
                    action=HITLAction.SUBMIT,
                    label="Approve & Generate Assets",
                    style="primary",
                ),
                HITLActionButton(
                    action=HITLAction.REJECT,
                    label="Cancel",
                    style="secondary",
                ),
            ],
        ),
    )

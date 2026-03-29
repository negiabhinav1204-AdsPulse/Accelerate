"""Budget approval tool — returns budget reallocation proposal (MODAL block).

Demonstrates: BlockDisplay.MODAL — inline trigger card in chat,
full approval form opens in modal dialog on click.
"""

import asyncio
import random
from langchain_core.tools import tool

from src.agentic_platform.core.engine.models import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.app.campaigns.blocks import (
    budget_approval, BudgetApprovalData, BudgetChange, BudgetApprovalTrigger,
)


@tool("propose_budget")
async def _propose_budget_changes(objective: str) -> dict:
    """Propose budget reallocation across campaigns to optimize for a goal.
    Use when the user wants to optimize budgets, reallocate spend, or
    asks how to improve campaign performance through budget changes."""

    await asyncio.sleep(random.uniform(1.0, 2.0))  # simulate optimization

    changes = [
        BudgetChange(
            campaign_name="Summer Sale",
            platform="google",
            current_budget=250,
            proposed_budget=350,
            reason="Highest ROAS (4.2x) — increase spend to capture more conversions.",
        ),
        BudgetChange(
            campaign_name="Brand Awareness",
            platform="meta",
            current_budget=200,
            proposed_budget=120,
            reason="Low ROAS (2.7x) — reduce spend and reallocate to higher performers.",
        ),
        BudgetChange(
            campaign_name="Retargeting Q4",
            platform="bing",
            current_budget=100,
            proposed_budget=180,
            reason="Best ROAS (5.1x) but underspending — increase to maximize returns.",
        ),
    ]

    total_current = sum(c.current_budget for c in changes)
    total_proposed = sum(c.proposed_budget for c in changes)

    return ToolResponse(
        summary=f"Budget reallocation proposal: ${total_current}/day → ${total_proposed}/day across {len(changes)} campaigns.",
        data={"total_current": total_current, "total_proposed": total_proposed, "changes": len(changes)},
        ui_blocks=[
            budget_approval.create(
                data=BudgetApprovalData(
                    proposal_id="prop-001",
                    title=f"Budget Optimization: {objective}",
                    total_current=total_current,
                    total_proposed=total_proposed,
                    changes=changes,
                    rationale=f"Reallocating budget to maximize {objective}. Moving spend from low-ROAS campaigns to high-ROAS campaigns.",
                ),
                trigger=BudgetApprovalTrigger(
                    title=f"Budget Proposal: {objective}",
                    change_count=len(changes),
                    total_proposed=total_proposed,
                ),
            ),
        ],
    ).model_dump()


propose_budget = AgenticTool(
    func=_propose_budget_changes,
    thinking_messages=[
        "Analyzing budget allocation...",
        "Optimizing spend distribution...",
        "Generating proposal...",
    ],
    tags=[ToolTag.RECOMMENDATIONS],
    timeout=15,
)

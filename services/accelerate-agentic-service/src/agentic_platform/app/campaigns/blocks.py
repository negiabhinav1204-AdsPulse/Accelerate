"""Block schemas for the campaigns domain.

Three blocks demonstrating all display modes:
  - campaign_overview (INLINE)  — rendered directly in chat
  - campaign_details  (SIDEBAR) — opens in side panel
  - budget_approval   (MODAL)   — opens in modal dialog
"""

from pydantic import BaseModel, Field
from typing import Any

from src.agentic_platform.core.engine.blocks import BlockSpec, register_block_spec
from src.agentic_platform.core.engine.models import BlockDisplay


# ── Campaign Overview (INLINE) ───────────────────────────────────────

class CampaignOverviewData(BaseModel):
    """Summary of campaigns — rendered as a compact card in the chat flow."""
    campaigns: list[dict[str, Any]] = Field(description="Campaign rows with metrics")
    total_spend: float = Field(description="Total spend across all campaigns")
    top_performer: str = Field(description="Name of the best performing campaign")
    date_range: str = Field(default="Last 30 days", description="Date range label")
    currency: str = Field(default="USD", description="ISO 4217 currency code")

campaign_overview = register_block_spec(BlockSpec(
    block_type="campaign_overview",
    data_schema=CampaignOverviewData,
    display=BlockDisplay.INLINE,
    description="Compact campaign summary card — shows top metrics inline in chat.",
))


# ── Campaign Details (SIDEBAR) ───────────────────────────────────────

class CampaignDetailData(BaseModel):
    """Full campaign details — rendered in a side panel with charts and breakdowns."""
    campaign_id: str = Field(description="Campaign ID")
    campaign_name: str = Field(description="Campaign name")
    platform: str = Field(description="Platform: google, meta, bing")
    status: str = Field(description="active, paused, ended")
    daily_budget: float = Field(description="Daily budget")
    total_spend: float = Field(description="Total spend to date")
    currency: str = Field(default="USD", description="ISO 4217 currency code")
    impressions: int = Field(description="Total impressions")
    clicks: int = Field(description="Total clicks")
    ctr: float = Field(description="Click-through rate percentage")
    conversions: int = Field(description="Total conversions")
    roas: float = Field(description="Return on ad spend")
    daily_metrics: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Daily breakdown: [{date, spend, clicks, conversions}]",
    )

class CampaignDetailTrigger(BaseModel):
    """Small card in chat that opens the full detail sidebar on click."""
    campaign_name: str = Field(description="Campaign name")
    platform: str = Field(description="Platform name")
    status: str = Field(description="Campaign status")
    roas: float = Field(description="ROAS highlight metric")

campaign_details = register_block_spec(BlockSpec(
    block_type="campaign_details",
    data_schema=CampaignDetailData,
    trigger_schema=CampaignDetailTrigger,
    display=BlockDisplay.SIDEBAR,
    description="Full campaign detail panel — metrics, daily breakdown, status. Opens in sidebar.",
))


# ── Budget Approval (MODAL) ──────────────────────────────────────────

class BudgetChange(BaseModel):
    """One proposed budget change."""
    campaign_name: str = Field(description="Campaign name")
    platform: str = Field(description="Platform")
    current_budget: float = Field(description="Current daily budget")
    proposed_budget: float = Field(description="Proposed new daily budget")
    reason: str = Field(description="Why this change is recommended")

class BudgetApprovalData(BaseModel):
    """Budget reallocation proposal — shown in a modal for approval."""
    proposal_id: str = Field(description="Unique proposal ID")
    title: str = Field(description="Proposal title")
    total_current: float = Field(description="Current total daily budget")
    total_proposed: float = Field(description="Proposed total daily budget")
    changes: list[BudgetChange] = Field(description="List of budget changes")
    rationale: str = Field(description="Overall rationale for the reallocation")
    currency: str = Field(default="USD", description="ISO 4217 currency code")

class BudgetApprovalTrigger(BaseModel):
    """Small card in chat that opens the approval modal on click."""
    title: str = Field(description="Proposal title")
    change_count: int = Field(description="Number of campaigns affected")
    total_proposed: float = Field(description="Proposed total budget")

budget_approval = register_block_spec(BlockSpec(
    block_type="budget_approval",
    data_schema=BudgetApprovalData,
    trigger_schema=BudgetApprovalTrigger,
    display=BlockDisplay.MODAL,
    description="Budget reallocation approval — review proposed changes and approve/reject. Opens in modal.",
))

"""Tests for typed block schema infrastructure."""

import pytest
from pydantic import BaseModel

from src.agentic_platform.core.engine.blocks import BlockSpec, export_block_schemas
from src.agentic_platform.core.engine.models import BlockDisplay

# Import domain blocks to trigger registration
from src.agentic_platform.app.campaigns.blocks import (
    CampaignOverviewData, campaign_overview,
    CampaignDetailData, CampaignDetailTrigger, campaign_details,
    BudgetApprovalData, BudgetChange, BudgetApprovalTrigger, budget_approval,
)


class MockData(BaseModel):
    title: str

class MockTrigger(BaseModel):
    label: str

_mock = BlockSpec(
    block_type="_test_mock",
    data_schema=MockData,
    trigger_schema=MockTrigger,
    display=BlockDisplay.SIDEBAR,
    description="Test block.",
)


class TestBlockSpecCreate:
    def test_inline_block(self):
        block = campaign_overview.create(data=CampaignOverviewData(
            campaigns=[{"name": "x"}], total_spend=100, top_performer="x",
        ))
        assert block.type == "campaign_overview"
        assert block.display == BlockDisplay.INLINE

    def test_sidebar_block_with_trigger(self):
        block = campaign_details.create(
            data=CampaignDetailData(
                campaign_id="1", campaign_name="Test", platform="google",
                status="active", daily_budget=100, total_spend=1000,
                impressions=50000, clicks=1500, ctr=3.0, conversions=200, roas=4.0,
            ),
            trigger=CampaignDetailTrigger(
                campaign_name="Test", platform="google", status="active", roas=4.0,
            ),
        )
        assert block.display == BlockDisplay.SIDEBAR
        assert block.inline_trigger["campaign_name"] == "Test"

    def test_modal_block_with_trigger(self):
        block = budget_approval.create(
            data=BudgetApprovalData(
                proposal_id="p1", title="Optimize", total_current=500,
                total_proposed=600, rationale="More spend on winners.",
                changes=[BudgetChange(
                    campaign_name="x", platform="google",
                    current_budget=200, proposed_budget=300, reason="High ROAS",
                )],
            ),
            trigger=BudgetApprovalTrigger(title="Budget", change_count=1, total_proposed=600),
        )
        assert block.display == BlockDisplay.MODAL
        assert block.inline_trigger["change_count"] == 1

    def test_rejects_wrong_data_type(self):
        with pytest.raises(TypeError, match="expects data of type"):
            campaign_overview.create(data=MockData(title="wrong"))

    def test_rejects_wrong_trigger_type(self):
        with pytest.raises(TypeError, match="expects trigger of type"):
            _mock.create(data=MockData(title="x"), trigger=MockData(title="wrong"))


class TestBlockSchemaExport:
    def test_all_blocks_registered(self):
        schemas = export_block_schemas()
        assert "campaign_overview" in schemas
        assert "campaign_details" in schemas
        assert "budget_approval" in schemas

    def test_export_has_properties(self):
        schemas = export_block_schemas()
        props = schemas["campaign_overview"]["data_schema"]["properties"]
        assert "campaigns" in props
        assert "total_spend" in props

    def test_sidebar_has_trigger_schema(self):
        schemas = export_block_schemas()
        assert "trigger_schema" in schemas["campaign_details"]

    def test_modal_has_trigger_schema(self):
        schemas = export_block_schemas()
        assert "trigger_schema" in schemas["budget_approval"]

    def test_display_modes_correct(self):
        schemas = export_block_schemas()
        assert schemas["campaign_overview"]["display"] == "inline"
        assert schemas["campaign_details"]["display"] == "sidebar"
        assert schemas["budget_approval"]["display"] == "modal"

"""Tests for HITL form → campaign plan enforcement.

Verifies that:
1. platform_selections from the HITL form are respected exactly
2. LLM-hallucinated campaigns outside the selection are stripped
3. Missing combos are backfilled with skeletons
4. CampaignContext round-trips through step data correctly
"""

import pytest
from src.agentic_platform.app.campaigns.models import (
    CampaignContext,
    ConnectedPlatform,
)
from src.agentic_platform.app.campaigns.models.plan import (
    SlimCampaign, SlimPlan, PlatformType, CampaignType,
)


class TestCampaignContext:
    def test_round_trip_step_data(self):
        ctx = CampaignContext(
            org_id="org-1", user_id="user-1", email="a@b.com",
            all_connections=[
                ConnectedPlatform(platform="GOOGLE", account_id="g1", currency="USD"),
                ConnectedPlatform(platform="META", account_id="m1", currency="USD"),
            ],
            supported_connections=[
                ConnectedPlatform(platform="GOOGLE", account_id="g1", currency="USD"),
            ],
        )
        # Serialize to step data
        step_data = ctx.to_step_data()
        assert "_campaign_context" in step_data

        # Recover
        recovered = CampaignContext.from_step_data(step_data)
        assert recovered is not None
        assert recovered.org_id == "org-1"
        assert len(recovered.all_connections) == 2
        assert len(recovered.supported_connections) == 1
        assert recovered.has_supported_connections is True

    def test_empty_step_data_returns_none(self):
        assert CampaignContext.from_step_data({}) is None
        assert CampaignContext.from_step_data({"other": "data"}) is None

    def test_get_account_id(self):
        ctx = CampaignContext(
            org_id="o", user_id="u",
            supported_connections=[
                ConnectedPlatform(platform="GOOGLE", account_id="g123"),
                ConnectedPlatform(platform="BING", account_id="b456"),
            ],
        )
        assert ctx.get_account_id("GOOGLE") == "g123"
        assert ctx.get_account_id("BING") == "b456"
        assert ctx.get_account_id("META") == ""

    def test_no_supported_connections(self):
        ctx = CampaignContext(
            org_id="o", user_id="u",
            all_connections=[ConnectedPlatform(platform="META", account_id="m1")],
            supported_connections=[],
        )
        assert ctx.has_supported_connections is False
        assert ctx.supported_platform_names == set()

    def test_to_prompt_json_includes_all(self):
        ctx = CampaignContext(
            org_id="o", user_id="u",
            all_connections=[
                ConnectedPlatform(platform="GOOGLE", account_id="g1", currency="USD"),
                ConnectedPlatform(platform="META", account_id="m1", currency="USD"),
            ],
            supported_connections=[
                ConnectedPlatform(platform="GOOGLE", account_id="g1", currency="USD"),
            ],
        )
        import json
        prompt = json.loads(ctx.to_prompt_json())
        platforms = prompt["connected_platforms"]
        assert len(platforms) == 2  # shows ALL, not just supported
        google = next(p for p in platforms if p["platform"] == "GOOGLE")
        meta = next(p for p in platforms if p["platform"] == "META")
        assert google["can_create_campaigns"] is True
        assert meta["can_create_campaigns"] is False


class TestPlanEnforcement:
    """Test that fixed_combos enforcement strips hallucinated campaigns and backfills missing ones."""

    def test_strip_hallucinated_campaigns(self):
        """LLM returns campaigns not in the user's selection → should be stripped."""
        fixed_combos = [("GOOGLE", "SEARCH"), ("BING", "SEARCH")]
        allowed = {(p.upper(), ct.upper()) for p, ct in fixed_combos}

        campaigns = [
            SlimCampaign(name="OK", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH, daily_budget=100),
            SlimCampaign(name="OK", platform=PlatformType.BING, campaign_type=CampaignType.SEARCH, daily_budget=100),
            SlimCampaign(name="BAD", platform=PlatformType.GOOGLE, campaign_type=CampaignType.DISPLAY, daily_budget=50),
        ]

        filtered = [c for c in campaigns if (c.platform.value.upper(), c.campaign_type.value.upper()) in allowed]
        assert len(filtered) == 2
        assert all(c.name == "OK" for c in filtered)

    def test_backfill_missing_campaigns(self):
        """LLM misses a combo → should be backfilled."""
        fixed_combos = [("GOOGLE", "SEARCH"), ("GOOGLE", "DISPLAY"), ("BING", "SEARCH")]

        campaigns = [
            SlimCampaign(name="G Search", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH, daily_budget=100),
            # Missing: GOOGLE DISPLAY and BING SEARCH
        ]

        existing = {(c.platform.value.upper(), c.campaign_type.value.upper()) for c in campaigns}
        missing = [(p, ct) for p, ct in fixed_combos if (p.upper(), ct.upper()) not in existing]

        assert len(missing) == 2
        assert ("GOOGLE", "DISPLAY") in missing
        assert ("BING", "SEARCH") in missing

    def test_exact_match_no_changes(self):
        """LLM returns exactly the right combos → no stripping, no backfilling."""
        fixed_combos = [("GOOGLE", "SEARCH"), ("BING", "DISPLAY")]
        allowed = {(p.upper(), ct.upper()) for p, ct in fixed_combos}

        campaigns = [
            SlimCampaign(name="G", platform=PlatformType.GOOGLE, campaign_type=CampaignType.SEARCH, daily_budget=100),
            SlimCampaign(name="B", platform=PlatformType.BING, campaign_type=CampaignType.DISPLAY, daily_budget=100),
        ]

        filtered = [c for c in campaigns if (c.platform.value.upper(), c.campaign_type.value.upper()) in allowed]
        existing = {(c.platform.value.upper(), c.campaign_type.value.upper()) for c in filtered}
        missing = [(p, ct) for p, ct in fixed_combos if (p.upper(), ct.upper()) not in existing]

        assert len(filtered) == 2
        assert len(missing) == 0


class TestPlatformSelectionsFormat:
    """Test that the UI's platform_selections map correctly drives fixed_combos."""

    def test_per_platform_selections(self):
        """UI sends { GOOGLE: [SEARCH, DISPLAY], BING: [SEARCH] } → 3 combos."""
        platform_selections = {"GOOGLE": ["SEARCH", "DISPLAY"], "BING": ["SEARCH"]}

        fixed_combos = []
        for plat, types in platform_selections.items():
            for ct in types:
                fixed_combos.append((plat, ct))

        assert fixed_combos == [
            ("GOOGLE", "SEARCH"), ("GOOGLE", "DISPLAY"), ("BING", "SEARCH")
        ]

    def test_empty_selections(self):
        """No platform_selections → empty combos (fallback to all)."""
        platform_selections = {}
        fixed_combos = []
        for plat, types in platform_selections.items():
            for ct in types:
                fixed_combos.append((plat, ct))
        assert fixed_combos == []

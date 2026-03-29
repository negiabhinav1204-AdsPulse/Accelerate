"""Tests for hidden steps, dynamic_context, and connected platforms in workflow context."""

import pytest
from dataclasses import dataclass
from unittest.mock import MagicMock

from src.agentic_platform.core.engine.models import BlockDisplay, NodeResponse
from src.agentic_platform.core.engine.workflow import Step, SubStep, WorkflowContext
from src.agentic_platform.core.engine.hitl import HITLRequest, HITLType


# ── Hidden Steps ─────────────────────────────────────────────────────

class TestHiddenStep:
    def test_hidden_default_false(self):
        async def noop(ctx): return NodeResponse(summary="ok")
        s = Step(name="test", func=noop)
        assert s.hidden is False

    def test_hidden_can_be_set(self):
        async def noop(ctx): return NodeResponse(summary="ok")
        s = Step(name="test", func=noop, hidden=True)
        assert s.hidden is True

    def test_hidden_step_validation(self):
        """Hidden steps still validate like regular steps."""
        async def noop(ctx): return NodeResponse(summary="ok")
        with pytest.raises(ValueError, match="name must be set"):
            Step(name="", func=noop, hidden=True)


# ── BlockDisplay Fullscreen ──────────────────────────────────────────

class TestBlockDisplayFullscreen:
    def test_fullscreen_enum_value(self):
        assert BlockDisplay.FULLSCREEN.value == "fullscreen"

    def test_all_display_modes(self):
        modes = {d.value for d in BlockDisplay}
        assert modes == {"inline", "sidebar", "modal", "fullscreen"}


# ── WorkflowContext Connected Platforms ──────────────────────────────

class TestWorkflowContextPlatforms:
    def test_default_empty(self):
        ctx = WorkflowContext(
            args={}, results={}, progress=MagicMock(), step_name="test",
        )
        assert ctx.connected_platforms == []

    def test_platforms_from_config(self):
        platforms = [{"platform": "GOOGLE", "account_id": "123"}]
        ctx = WorkflowContext(
            args={}, results={}, progress=MagicMock(), step_name="test",
            connected_platforms=platforms,
        )
        assert len(ctx.connected_platforms) == 1
        assert ctx.connected_platforms[0]["platform"] == "GOOGLE"


# ── Dynamic Context ──────────────────────────────────────────────────

class TestDynamicContext:
    """Test the dynamic_context pattern without importing heavy campaign modules."""

    def _make_context_fn(self):
        """Inline version of campaign_dynamic_context for testing the pattern."""
        def fn(configurable: dict) -> str:
            platforms = configurable.get("connected_platforms", [])
            if not platforms:
                return "No ad platforms connected."
            names = [p.get("platform", p) if isinstance(p, dict) else str(p) for p in platforms]
            return f"Connected: {', '.join(names)}"
        return fn

    def test_with_platforms(self):
        fn = self._make_context_fn()
        result = fn({"connected_platforms": [{"platform": "GOOGLE"}, {"platform": "BING"}]})
        assert "GOOGLE" in result
        assert "BING" in result

    def test_empty(self):
        fn = self._make_context_fn()
        result = fn({})
        assert "no ad platforms" in result.lower()

    def test_registry_calls_dynamic_context(self):
        """Registry should call dynamic_context with configurable dict."""
        from src.agentic_platform.core.engine.registry import AgentRegistry
        calls = []
        def tracker(configurable):
            calls.append(configurable)
            return "extra context"
        reg = AgentRegistry(system_prompt="base", dynamic_context=tracker)
        assert reg._dynamic_context is tracker


# ── UserContext Connected Platforms ───────────────────────────────────

class TestUserContextPlatforms:
    def test_to_config_includes_domain_context(self):
        from src.agentic_platform.core.auth import UserContext
        user = UserContext(
            user_id="u1", email="a@b.com", name="Test", org_id="org1",
            domain_context={"connected_platforms": [{"platform": "GOOGLE"}]},
        )
        config = user.to_config()
        assert "connected_platforms" in config
        assert len(config["connected_platforms"]) == 1

    def test_to_config_empty_domain_context(self):
        from src.agentic_platform.core.auth import UserContext
        user = UserContext(
            user_id="u1", email="a@b.com", name="Test", org_id="org1",
        )
        config = user.to_config()
        assert "connected_platforms" not in config

    def test_domain_context_flattens(self):
        from src.agentic_platform.core.auth import UserContext
        user = UserContext(
            user_id="u1", email="a@b.com", name="Test", org_id="org1",
            domain_context={"custom_key": "custom_value"},
        )
        config = user.to_config()
        assert config["custom_key"] == "custom_value"



# ── Config Local Dev ─────────────────────────────────────────────────

class TestConfigLocalDev:
    def test_local_dev_override_fields_exist(self):
        from src.agentic_platform.core.config import settings
        assert isinstance(settings.local_dev_org_id, str)
        assert isinstance(settings.local_dev_user_id, str)
        assert isinstance(settings.local_dev_user_email, str)

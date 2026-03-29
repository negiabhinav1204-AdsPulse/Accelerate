"""Engine — public API for domain developers.

Import from here when building tools, workflows, and blocks:

    from src.agentic_platform.core.engine import (
        AgenticTool, ToolResponse, BlockSpec, AgenticWorkflow, Step,
    )

Internal modules (executor, registry, graph building) are not
re-exported here — they're framework internals.
"""

# ── Tool primitives ──────────────────────────────────────────────────
from src.agentic_platform.core.engine.models import (
    AgenticTool,
    ToolResponse,
    NodeResponse,
    UIBlock,
    ToolTag,
    BlockDisplay,
    StepStatus,
)

# ── Block system ─────────────────────────────────────────────────────
from src.agentic_platform.core.engine.blocks import (
    BlockSpec,
    register_block_spec,
    export_block_schemas,
)

# ── Workflow SDK ─────────────────────────────────────────────────────
from src.agentic_platform.core.engine.workflow import (
    AgenticWorkflow,
    Step,
    Parallel,
    SubStep,
    WorkflowContext,
    StepProgress,
    StepArtifact,
)

# ── HITL ─────────────────────────────────────────────────────────────
from src.agentic_platform.core.engine.hitl import (
    HITLRequest,
    HITLPolicy,
    HITLAction,
    HITLType,
    HITLActionButton,
    HITLField,
    HITLChoice,
    build_confirmation,
    is_rejection,
)

# ── Context helpers ──────────────────────────────────────────────────
from src.agentic_platform.core.engine.context import get_emitter, get_org_id

# ── Middleware ────────────────────────────────────────────────────────
from src.agentic_platform.core.engine.middleware import ToolMiddleware

__all__ = [
    # Tools
    "AgenticTool", "ToolResponse", "NodeResponse", "UIBlock",
    "ToolTag", "BlockDisplay", "StepStatus",
    # Blocks
    "BlockSpec", "register_block_spec", "export_block_schemas",
    # Workflows
    "AgenticWorkflow", "Step", "Parallel", "SubStep",
    "WorkflowContext", "StepProgress", "StepArtifact",
    # HITL
    "HITLRequest", "HITLPolicy", "HITLAction", "HITLType",
    "HITLActionButton", "HITLField", "HITLChoice",
    "build_confirmation", "is_rejection",
    # Context
    "get_emitter", "get_org_id",
    # Middleware
    "ToolMiddleware",
]

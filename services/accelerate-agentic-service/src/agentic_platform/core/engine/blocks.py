"""Typed UI block system.

Each block type is defined by a BlockSpec — a Pydantic model for the data
payload, optional trigger payload, and display config. This gives:
  1. Backend validation — tools can't emit malformed blocks
  2. Frontend contract — TypeScript types generated from JSON Schema
  3. AI UI generation — LLM knows the exact shape to produce

Block specs are registered in BLOCK_SPECS. Tools use TypedUIBlock.create()
which validates data against the spec at construction time.

Usage:
    # Define a block spec (in domains/<domain>/tools/blocks.py)
    class AnalyticsTableData(BaseModel):
        rows: list[dict[str, Any]]
        sql: str
        question: str

    class AnalyticsTableTrigger(BaseModel):
        title: str
        row_count: int

    analytics_table_spec = BlockSpec(
        block_type="analytics_table",
        data_schema=AnalyticsTableData,
        trigger_schema=AnalyticsTableTrigger,  # optional
        display=BlockDisplay.INLINE,
    )

    # Use in a tool
    block = analytics_table_spec.create(
        data=AnalyticsTableData(rows=rows, sql=sql, question=question),
    )

    # Export all schemas as JSON (for frontend codegen)
    schemas = export_block_schemas()
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Type

from pydantic import BaseModel

from src.agentic_platform.core.engine.models import UIBlock, BlockDisplay

logger = logging.getLogger(__name__)


# ── Block Spec ───────────────────────────────────────────────────────

@dataclass
class BlockSpec:
    """Definition of a UI block type — schema + display config.

    Each block type in the system gets one of these. It defines:
    - block_type: the string identifier ("analytics_table")
    - data_schema: Pydantic model for the main data payload
    - trigger_schema: Pydantic model for the inline trigger (sidebar/modal)
    - display: default display mode (inline/sidebar/modal)
    """
    block_type: str
    data_schema: Type[BaseModel]
    trigger_schema: Type[BaseModel] | None = None
    display: BlockDisplay = BlockDisplay.INLINE
    description: str = ""  # for AI UI generation — what this block shows

    def create(
        self,
        data: BaseModel,
        trigger: BaseModel | None = None,
        display: BlockDisplay | None = None,
    ) -> UIBlock:
        """Create a validated UIBlock from typed data.

        Validates that data matches data_schema and trigger matches
        trigger_schema. Raises ValidationError if not.
        """
        if not isinstance(data, self.data_schema):
            raise TypeError(
                f"Block '{self.block_type}' expects data of type {self.data_schema.__name__}, "
                f"got {type(data).__name__}"
            )

        if trigger and self.trigger_schema and not isinstance(trigger, self.trigger_schema):
            raise TypeError(
                f"Block '{self.block_type}' expects trigger of type {self.trigger_schema.__name__}, "
                f"got {type(trigger).__name__}"
            )

        effective_display = display or self.display
        trigger_data = trigger.model_dump() if trigger else None

        # For non-inline blocks, trigger is required
        if effective_display != BlockDisplay.INLINE and not trigger_data:
            logger.warning(
                "Block '%s' has display=%s but no inline_trigger — "
                "frontend will use default trigger button",
                self.block_type, effective_display.value,
            )

        return UIBlock(
            type=self.block_type,
            data=data.model_dump(),
            display=effective_display,
            inline_trigger=trigger_data,
        )

    def json_schema(self) -> dict:
        """Export the full schema for this block type (for frontend codegen + AI)."""
        schema: dict[str, Any] = {
            "block_type": self.block_type,
            "description": self.description,
            "display": self.display.value,
            "data_schema": self.data_schema.model_json_schema(),
        }
        if self.trigger_schema:
            schema["trigger_schema"] = self.trigger_schema.model_json_schema()
        return schema


# ── Block Registry ───────────────────────────────────────────────────

_BLOCK_SPECS: dict[str, BlockSpec] = {}


def register_block_spec(spec: BlockSpec) -> BlockSpec:
    """Register a block spec. Called at import time from domain block files."""
    if spec.block_type in _BLOCK_SPECS:
        raise ValueError(f"Block type '{spec.block_type}' already registered")
    _BLOCK_SPECS[spec.block_type] = spec
    return spec


def get_block_spec(block_type: str) -> BlockSpec | None:
    return _BLOCK_SPECS.get(block_type)


def export_block_schemas() -> dict[str, Any]:
    """Export all registered block schemas as JSON.

    Used for:
    - Frontend TypeScript type generation
    - AI UI generation (LLM sees exact shapes)
    - API documentation
    """
    return {
        name: spec.json_schema()
        for name, spec in _BLOCK_SPECS.items()
    }


def export_block_schemas_json() -> str:
    """Export as formatted JSON string."""
    return json.dumps(export_block_schemas(), indent=2)

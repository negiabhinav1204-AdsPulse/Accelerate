# Core Engine

The execution framework for tools, workflows, blocks, and HITL. Domain code (`app/`) imports from `engine/__init__.py`.

## Public API (`__init__.py`)

Everything a domain developer needs is re-exported from `__init__.py`. Import from here, not from individual files.

## Models (`models.py`)

### AgenticTool
Wraps a LangChain `@tool` with framework features.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `func` | `BaseTool` | required | Must be `@tool` decorated |
| `thinking_messages` | `list[str]` | default list | Random choice shown during execution |
| `tags` | `list[ToolTag]` | `[]` | ANALYTICS, CAMPAIGN_MGMT, DIAGNOSTICS, RECOMMENDATIONS |
| `timeout` | `int` | 30 | Seconds. Must be > 0 |
| `hitl_policy` | `str` | `"never"` | `"never"` or `"always"` (pre-execution gate) |

Validation: name must not start with `_`, must have a description (docstring).

### ToolResponse
Return type for ALL tools. Always call `.model_dump()`.

| Field | Type | Default | Goes to |
|-------|------|---------|---------|
| `summary` | `str` | `None` | LLM (via ToolMessage) |
| `data` | `Any` | `None` | LLM (as JSON) |
| `ui_blocks` | `list[UIBlock]` | `[]` | Frontend only (stripped by `for_llm()`) |
| `metadata` | `dict` | `{}` | Neither — internal carry |
| `hitl` | `HITLRequest` | `None` | Post-execution HITL gate |

### NodeResponse
Same shape as ToolResponse but for workflow steps. No `.model_dump()` needed.

### UIBlock
| Field | Type | Default |
|-------|------|---------|
| `type` | `str` | required |
| `data` | `dict` | required |
| `display` | `BlockDisplay` | INLINE |
| `inline_trigger` | `dict` | `None` |

### Enums
- **ToolTag:** ANALYTICS, CAMPAIGN_MGMT, DIAGNOSTICS, RECOMMENDATIONS
- **BlockDisplay:** INLINE, SIDEBAR, MODAL, FULLSCREEN
- **StepStatus:** PENDING, ACTIVE, DONE, ERROR, REVIEW, CANCELLED, COMPLETED

## Blocks (`blocks.py`)

Type-safe contracts between backend tools and frontend components.

```python
spec = register_block_spec(BlockSpec(
    block_type="my_block",           # Frontend BLOCK_REGISTRY key
    data_schema=MyDataModel,         # Pydantic model (validated at creation)
    trigger_schema=MyTriggerModel,   # For SIDEBAR/MODAL/FULLSCREEN inline cards
    display=BlockDisplay.SIDEBAR,
))

# In tool: spec.create(data=MyDataModel(...), trigger=MyTriggerModel(...))
```

- `register_block_spec()` — call at module import time
- `export_block_schemas()` — returns all schemas (served at `/api/v1/block-schemas`)
- Block type strings are the ONLY coupling between backend and frontend

## Workflow SDK (`workflow.py`)

### Primitives
- **Step(name, func, label)** — one LangGraph node, executes your async function
- **Parallel(name, steps, label)** — one node, runs children via `asyncio.gather` (min 2 steps)
- **SubStep(name, label)** — progress-only (no graph node), reported via `ctx.progress`

### StepProgress
Available as `ctx.progress` when step has `substeps=[]`:
- `start(name)` — mark substep active
- `done(name, summary="")` — mark complete
- `error(name, message="")` — mark failed
- `update(name, message)` — update summary without status change

Steps WITHOUT substeps get `_NullProgress` which raises `ValueError` if you call `.start()`.

### StepArtifact
Structured insights for the sidebar. Emitted via `ctx.emit_artifact(StepArtifact(...))`.

### AgenticWorkflow
| Field | Type | Default |
|-------|------|---------|
| `trigger` | `BaseTool` | required |
| `title` | `str` | required (supports `{arg}` interpolation) |
| `steps` | `list[Step\|Parallel]` | required, non-empty |
| `tags` | `list[str]` | `[]` |
| `finalize` | callback | `None` (auto-generates summary) |

`build_graph()` compiles to: `parse_trigger -> step1 -> step2 -> ... -> finalize` with error/cancel routing.

## HITL (`hitl.py`)

### HITLRequest
| Field | Type | Default |
|-------|------|---------|
| `hitl_id` | `str` | auto-generated |
| `type` | `HITLType` | CONFIRMATION |
| `title` | `str` | `""` |
| `description` | `str` | `None` |
| `danger` | `bool` | `False` (red styling) |
| `payload` | `dict` | `{}` |
| `actions` | `list[HITLActionButton]` | `[]` |
| `fields` | `list[HITLField]` | `None` |
| `choices` | `list[HITLChoice]` | `None` |

### HITLField types
text, textarea, number, slider, date, select, multiselect, toggle, email, url, color

### Functions
- `build_confirmation(title, description, payload, danger)` — quick approve/reject
- `request_human_input(request)` — THE ONLY place `interrupt()` is called. Do not call `interrupt()` directly.
- `is_rejection(action)` — True for "reject" and "cancel"

## Executor (`executor.py`)

`StreamingToolNode` — DO NOT instantiate directly. `AgentRegistry` creates it.

Execution order per tool call:
1. Emit thinking → 2. Pre-HITL gate → 3. Middlewares → 4. Execute → 5. Parse response → 6. Emit blocks → 7. Post-HITL gate → 8. Return ToolMessage

Safe tools run concurrently. HITL tools run sequentially.

## Registry (`registry.py`)

`AgentRegistry` — DO NOT instantiate directly. `loader.py` creates it.

- `register_tool(AgenticTool)` → adds to tool list
- `register_workflow(AgenticWorkflow)` → adds trigger + sub-graph
- `build_graph(llm, checkpointer)` → compiled LangGraph with agent + tools + workflows

## MCP (`mcp/`)

Wraps external MCP server tools as `AgenticTool` instances. Configured via YAML or dict in `AgentConfig.mcp_servers`.

- `MCPToolRegistry.from_yaml(path)` — connect to servers, discover tools
- Tools get `AgenticTool` wrapping with configurable thinking_messages, tags, timeout, hitl_policy
- `ResultTransformer` — convert raw MCP output to `ToolResponse` format
- `ToolMiddleware` — pre-execution arg transformation (e.g., inject org_id into SQL)

## Internal Modules (prefixed with `_`)

- `_workflow_graph.py` — LangGraph node factories (make_step_wave, make_finalize_node, etc.)
- `_workflow_runtime.py` — Step execution + snapshot helpers

These are implementation details. Never import from them in `app/` code.

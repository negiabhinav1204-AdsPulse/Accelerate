# Accelerate Agentic Service

## GOLDEN RULE

**Never invent something new if it already exists in this codebase.** Before creating any class, helper, client, or pattern — search for it first. This platform has purpose-built abstractions for tools, workflows, blocks, HITL, HTTP clients, image generation, streaming, and LLM calls. Use them.

## What This Service Does

AI agent platform: LLM + tools + workflows + streaming. The LLM receives a user message, decides which tools to call, gets structured responses, and streams everything in real-time. Currently serves a chat UI via AG-UI SSE protocol, but the core engine is transport-agnostic.

## Architecture — 3 Layers

```
core/    Engine. Tools, workflows, LLM, graph execution. No HTTP, no AG-UI.
api/     HTTP transport. Chat routes, SSE streaming, AG-UI event projection.
app/     Domain code. Tools, workflows, blocks, prompts. YOUR CODE GOES HERE.
```

**Dependency rule:** `core <- api`, `core <- app`. App and API never import each other (except `api/server.py` imports `app.get_all_agent_configs()` for agent discovery).

## Project Structure

```
src/agentic_platform/
  core/                            # DON'T TOUCH (unless building engine features)
    config.py                      # Pydantic Settings — ALL env vars
    llm.py                         # get_llm(), structured_llm_call()
    execution.py                   # Generic graph executor
    auth.py                        # UserContext, request_auth_token ContextVar
    stream_emitter.py              # Typed StreamWriter wrapper
    engine/                        # Tool/workflow framework
      __init__.py                  # PUBLIC API — import from here
      models.py                    # AgenticTool, ToolResponse, NodeResponse, UIBlock
      executor.py                  # StreamingToolNode (auto-streaming + HITL gate)
      registry.py                  # AgentRegistry (builds LangGraph)
      workflow.py                  # AgenticWorkflow, Step, Parallel, SubStep
      blocks.py                    # BlockSpec, register_block_spec
      hitl.py                      # HITLRequest, build_confirmation
      context.py                   # get_emitter(), get_org_id()
      middleware.py                # ToolMiddleware ABC
      mcp/                         # MCP server integration
    agents/
      config.py                    # AgentConfig dataclass
      loader.py                    # load_all_agents(), LoadedAgent
    infra/
      http_client/                 # ServiceClient — USE THIS for all HTTP calls
      gcs_client/                  # GCS upload (SHA-256 dedup)
      image/                       # ImageGateway (OpenAI, Imagen, Gemini)

  api/                             # HTTP layer
    server.py                      # FastAPI app, lifespan, /health, /agents
    sse.py                         # AG-UI EventEncoder
    middleware.py                  # JWT auth middleware
    chat/                          # Chat-specific endpoints
      routes.py                    # POST /chat, GET /messages, /conversations
      orchestration.py             # Graph -> AG-UI events -> SSE stream
      persistence.py               # db-service REST client
      stream_reducer.py            # AG-UI event accumulation

  app/                             # YOUR DOMAIN CODE
    __init__.py                    # get_all_agent_configs() — register agents here
    campaigns/                     # Campaign domain
      agent.py                     # AgentConfig
      blocks.py                    # BlockSpec definitions
      tools/                       # Tool implementations
      workflows/                   # Workflow + steps/
      prompts/                     # System prompt + dynamic context
      services/                    # External service clients
      models/                      # Pydantic domain models
    common/                        # Shared across agents
      tools/image_gen.py           # generate_image tool
      blocks.py                    # Image block specs
      mcp_servers.py               # MCP server config loader
```

## What Exists (DO NOT Reinvent)

| Need | Use This | Location |
|------|----------|----------|
| Wrap a tool for the agent | `AgenticTool` | `core/engine/models.py` |
| Return data from a tool | `ToolResponse` | `core/engine/models.py` |
| Return data from a workflow step | `NodeResponse` | `core/engine/models.py` |
| Send rich UI to frontend | `UIBlock` + `BlockSpec` | `core/engine/blocks.py` |
| Multi-step pipeline | `AgenticWorkflow` + `Step` + `Parallel` | `core/engine/workflow.py` |
| Pause for user input | `HITLRequest` + `build_confirmation` | `core/engine/hitl.py` |
| Call an LLM | `get_llm()` or `structured_llm_call()` | `core/llm.py` |
| Call another service over HTTP | `ServiceClient` | `core/infra/http_client/` |
| Generate images | `ImageGateway` | `core/infra/image/provider.py` |
| Upload to GCS | `GCSClient` | `core/infra/gcs_client/` |
| Read config/env vars | `settings.xxx` | `core/config.py` |
| Get current user's org | `get_org_id(config)` | `core/engine/context.py` |
| Get auth token in request | `request_auth_token.get()` | `core/auth.py` |
| Stream progress mid-tool | `get_emitter(config)` | `core/engine/context.py` |
| Configure an agent | `AgentConfig` | `core/agents/config.py` |

## Imports — Single Import Point

All public types for domain developers come from `core/engine/__init__.py`:

```python
from src.agentic_platform.core.engine import (
    # Tools
    AgenticTool, ToolResponse, NodeResponse, UIBlock, ToolTag, BlockDisplay, StepStatus,
    # Blocks
    BlockSpec, register_block_spec,
    # Workflows
    AgenticWorkflow, Step, Parallel, SubStep, WorkflowContext, StepProgress, StepArtifact,
    # HITL
    HITLRequest, HITLPolicy, HITLAction, HITLType, HITLActionButton, HITLField, HITLChoice,
    build_confirmation, is_rejection,
    # Context
    get_emitter, get_org_id,
    # Middleware
    ToolMiddleware,
)

from src.agentic_platform.core.agents.config import AgentConfig
from src.agentic_platform.core.llm import get_llm, structured_llm_call
from src.agentic_platform.core.config import settings
from src.agentic_platform.core.infra.http_client import ServiceClient
```

## How to Add a Tool

1. Create in `app/<domain>/tools/my_tool.py`
2. Register in `AgentConfig.tools` in `app/<domain>/agent.py`

```python
from langchain_core.tools import tool
from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag

@tool("get_campaign_roi")
async def _get_campaign_roi(campaign_id: str) -> dict:
    """Get ROI metrics for a campaign. Use when the user asks about
    campaign performance, returns, or spend efficiency."""
    data = await fetch_roi(campaign_id)
    return ToolResponse(
        summary=f"Campaign {campaign_id}: {data['roi']}% ROI",  # LLM sees this
        data=data,                                                # LLM gets this as JSON
        ui_blocks=[...],                                          # Frontend renders this
    ).model_dump()

get_campaign_roi = AgenticTool(
    func=_get_campaign_roi,
    thinking_messages=["Analyzing ROI..."],
    tags=[ToolTag.ANALYTICS],
    timeout=30,
)
```

### Tool Rules

| Rule | Why |
|------|-----|
| `@tool("name")` — no leading underscore | LangGraph validates tool names |
| Function name `_name` — WITH underscore | Convention: private fn wrapped in AgenticTool |
| Always return `ToolResponse(...).model_dump()` | Framework handles streaming uniformly |
| Docstring is REQUIRED and CRITICAL | LLM reads it to decide WHEN to call the tool |
| `summary` = for LLM reasoning | LLM never sees ui_blocks |
| `ui_blocks` = for human eyes | Frontend renders these as rich components |
| Never emit SSE events from a tool | StreamingToolNode does all streaming |
| `timeout` default is 30s | Set higher for slow tools |

### Tool Execution Flow (what the framework does automatically)

```
LLM decides to call your tool
  1. Framework emits THINKING indicator ("Analyzing ROI...")
  2. Framework emits STEP_STARTED
  3. Pre-execution HITL gate (if hitl_policy="always")
  4. Runs middlewares (if any)
  5. Executes your function with timeout
  6. Parses ToolResponse
  7. Emits CUSTOM events for ui_blocks
  8. Post-execution HITL gate (if response.hitl is set)
  9. Framework emits STEP_FINISHED
  10. Returns ToolMessage to LLM (summary + data, NO blocks)
LLM gets the summary, reasons about it, may call another tool or respond
```

## How to Add a Workflow

1. Create trigger + steps in `app/<domain>/workflows/`
2. Register in `AgentConfig.workflows` in `app/<domain>/agent.py`

```python
from langchain_core.tools import tool
from src.agentic_platform.core.engine import (
    AgenticWorkflow, Step, Parallel, SubStep, WorkflowContext, NodeResponse, StepArtifact,
)

# Trigger — LLM calls this to start the workflow
@tool("create_media_plan")
async def _create_media_plan(url: str, budget: float) -> dict:
    """Create a full media plan. Use when the user wants to build a new campaign."""
    raise NotImplementedError  # Framework routes to workflow sub-graph

# Step function — receives WorkflowContext, returns NodeResponse
async def research(ctx: WorkflowContext) -> NodeResponse:
    data = await scrape(ctx.args["url"])          # ctx.args = trigger arguments
    return NodeResponse(summary=f"Scraped {len(data)} pages", data=data)

async def analyze(ctx: WorkflowContext) -> NodeResponse:
    scraped = ctx.results["research"].data         # ctx.results = prior step outputs
    ctx.progress.start("market")                   # SubStep progress
    market = await analyze_market(scraped)
    ctx.progress.done("market", summary="Done")
    ctx.emit_artifact(StepArtifact(                # Insights sidebar
        type="market_context", title="Market Analysis", data=market
    ))
    return NodeResponse(summary="Analysis complete", data=market)

create_media_plan = AgenticWorkflow(
    trigger=_create_media_plan,
    title="Creating media plan for {url}",          # {url} interpolated from args
    steps=[
        Step("research", research, label="Research website"),
        Step("analyze", analyze, label="Analyze market", substeps=[
            SubStep("market", "Market analysis"),
            SubStep("brand", "Brand analysis"),
        ]),
        Parallel("create", label="Create assets", steps=[
            Step("register", register_fn, label="Register plan"),
            Step("generate", generate_fn, label="Generate assets"),
        ]),
        Step("save", save_fn, label="Save"),
    ],
)
```

### WorkflowContext Fields

| Field | Type | Description |
|-------|------|-------------|
| `ctx.args` | `dict` | Trigger tool arguments |
| `ctx.results` | `dict[str, NodeResponse]` | Completed step results by name |
| `ctx.progress` | `StepProgress` | `.start(name)`, `.done(name, summary)`, `.error(name, msg)` |
| `ctx.step_name` | `str` | Current step name |
| `ctx.user_id` | `str` | Current user |
| `ctx.org_id` | `str` | Current org |
| `ctx.connected_platforms` | `list` | User's connected ad platforms |
| `ctx.emit_artifact(...)` | method | Emit insights for the sidebar |

### Step Configuration

| Field | Default | Description |
|-------|---------|-------------|
| `name` | required | Unique identifier (alphanumeric + underscore) |
| `func` | required | `async def(ctx: WorkflowContext) -> NodeResponse` |
| `label` | auto from name | Display label |
| `timeout` | 60 | Seconds before timeout error |
| `substeps` | `[]` | List of `SubStep` for progress reporting |
| `hidden` | `False` | If True, step runs silently (no progress card) |
| `thinking_messages` | defaults | Random message shown while step runs |

### HITL in Workflows

Return `NodeResponse(hitl=HITLRequest(...))` to pause and ask the user:

```python
from src.agentic_platform.core.engine import HITLRequest, HITLField, HITLActionButton, HITLAction

async def configure(ctx: WorkflowContext) -> NodeResponse:
    return NodeResponse(
        summary="Ready for review",
        data=plan,
        hitl=HITLRequest(
            type="form",
            title="Review settings",
            fields=[
                HITLField(name="budget", label="Budget", type="number", default=50000),
                HITLField(name="start_date", label="Start Date", type="date"),
            ],
            actions=[
                HITLActionButton(action=HITLAction.SUBMIT, label="Approve", style="primary"),
                HITLActionButton(action=HITLAction.REJECT, label="Cancel"),
            ],
        ),
    )
# Next step reads: ctx.results["configure"].metadata["user_input"]
```

HITL types: `confirmation` (approve/reject buttons), `form` (dynamic inputs), `choice` (pick one).

## How to Add a Block

Blocks send rich UI from backend to frontend. The `block_type` string is the only coupling.

```python
# 1. Backend: app/<domain>/blocks.py
from pydantic import BaseModel
from src.agentic_platform.core.engine import BlockSpec, register_block_spec, BlockDisplay

class ROIData(BaseModel):
    campaign_id: str
    roi_percent: float

roi_block = register_block_spec(BlockSpec(
    block_type="campaign_roi",       # Must match frontend BLOCK_REGISTRY key
    data_schema=ROIData,
    display=BlockDisplay.INLINE,     # INLINE | SIDEBAR | MODAL | FULLSCREEN
))

# 2. Emit from tool
return ToolResponse(
    summary="ROI is 145%",
    ui_blocks=[roi_block.create(data=ROIData(campaign_id="123", roi_percent=145.2))],
).model_dump()
```

For SIDEBAR/MODAL/FULLSCREEN blocks, also define `trigger_schema` for the clickable card.

## How to Add a New Agent

```python
# 1. app/my_domain/agent.py
config = AgentConfig(
    agent_id="my-agent",           # URL-safe, kebab-case
    name="My Agent",
    system_prompt="You are ...",
    tools=[my_tool],
    workflows=[my_workflow],
    model="sonnet",                # Key from MODELS dict
    checkpointer_db_url=settings.checkpointer_db_url,
    db_service_url=settings.db_service_url,
)

# 2. Register in app/__init__.py
def get_all_agent_configs():
    from src.agentic_platform.app.my_domain.agent import config as my_config
    return [campaigns_config, my_config]
```

## AgentConfig Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `agent_id` | yes | — | URL-safe ID (kebab-case) |
| `name` | yes | — | Display name |
| `system_prompt` | yes | — | Full system prompt |
| `tools` | no | `[]` | List of AgenticTool |
| `workflows` | no | `[]` | List of AgenticWorkflow |
| `model` | no | `"sonnet"` | LLM alias from MODELS dict |
| `dynamic_context` | no | `None` | `fn(metadata) -> str` appended to prompt per-request |
| `hydrate_context` | no | `None` | `async fn(user)` enriches UserContext before graph |
| `mcp_servers` | no | `None` | YAML path or dict for MCP tools |
| `checkpointer_db_url` | yes | — | Postgres URL for LangGraph state |
| `db_service_url` | yes | — | REST URL for message persistence |

## LLM Models (MODELS dict in core/config.py)

| Alias | Model |
|-------|-------|
| `haiku` | claude-haiku-4-5 |
| `sonnet` | claude-sonnet-4-6 |
| `opus` | claude-opus-4-6 |
| `gpt-mini` | gpt-4.1-mini |
| `gpt` | gpt-4.1 |
| `gpt-pro` | gpt-5.4 |
| `flash` | gemini-2.5-flash |
| `gemini-pro` | gemini-2.5-pro |

Use via: `get_llm("sonnet")` or `structured_llm_call(prompt, schema, model="haiku")`

## HTTP Calls

**DO NOT create httpx clients.** Use `ServiceClient`:

```python
from src.agentic_platform.core.infra.http_client import ServiceClient

client = ServiceClient("campaign-service", base_url=settings.campaign_service_url)
resp = await client.get("/campaigns/", params={"org_id": org_id})
campaigns = resp["body"]  # Returns {"status_code", "body", "headers", "elapsed_ms"}
```

`ServiceClient` provides: connection pooling, retry with backoff, circuit breaker, Prometheus metrics, auth token forwarding.

## Configuration

**All env vars in `core/config.py` via Pydantic Settings.** Never use `os.getenv()`.

```python
from src.agentic_platform.core.config import settings
url = settings.db_service_url        # CORRECT
url = os.getenv("DB_SERVICE_URL")    # WRONG — never do this
```

To add a new env var: add a field to `Settings` class in `core/config.py`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agents/{agent_id}/chat/{conv_id}` | Send message, receive SSE stream |
| POST | `/api/v1/agents/{agent_id}/chat/` | New conversation |
| GET | `/api/v1/agents/{agent_id}/conversations/{conv_id}/messages` | Get messages + workflows |
| GET | `/api/v1/agents/{agent_id}/conversations/latest` | Latest conversation for user |
| POST | `/api/v1/agents/{agent_id}/conversations` | Create empty conversation |
| GET | `/api/v1/agents/` | List agents |
| GET | `/api/v1/block-schemas` | Export block schemas (for frontend codegen) |
| GET | `/health` | Health check |

## How to Run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.agentic_platform.api.server:app --port 8080 --reload
curl http://localhost:8080/health
```

## DO NOT

- **Do not use `os.getenv()`** — use `settings.xxx` from `core/config.py`
- **Do not create HTTP clients** — use `ServiceClient` from `core/infra/http_client/`
- **Do not emit SSE events from tools** — `StreamingToolNode` handles all streaming
- **Do not call `interrupt()` directly** — use `HITLRequest` or `build_confirmation()`
- **Do not build LangGraph graphs manually** — use `AgenticWorkflow` + `AgentRegistry`
- **Do not import from `api/` in `app/`** — app depends only on core
- **Do not import from `app/` in `core/`** — core is domain-agnostic
- **Do not hardcode LLM providers** — use `get_llm(alias)` with MODELS dict
- **Do not create new base classes for tools** — use `AgenticTool` wrapper
- **Do not return raw dicts from tools** — use `ToolResponse(...).model_dump()`

## Sub-Module Documentation

Detailed CLAUDE.md files exist for key sub-modules:
- `core/engine/CLAUDE.md` — Tool framework, workflow SDK, blocks, HITL
- `core/infra/http_client/CLAUDE.md` — HTTP client, retry, circuit breaker
- `api/chat/CLAUDE.md` — Chat orchestration, AG-UI protocol, persistence
- `app/campaigns/CLAUDE.md` — Campaign domain tools, workflows, blocks

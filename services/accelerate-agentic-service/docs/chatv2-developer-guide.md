# ChatV2 Developer Guide

## The Mental Model

An **agent** is an LLM with tools. The LLM reads the user's message, decides which tool to call, gets a response, and either calls another tool or responds to the user. Everything streams in real-time via SSE.

```
User message  -->  LLM thinks  -->  calls tool  -->  gets result  -->  LLM responds
                                         |
                              ToolResponse {
                                summary: "for the LLM"
                                ui_blocks: [for the human]
                              }
```

**Workflows** are multi-step tool pipelines. The LLM triggers one, then a fixed sequence of steps runs automatically with a live progress card.

**Blocks** are the bridge between backend data and frontend UI. Backend emits `{ type: "campaign_overview", data: {...} }`, frontend renders the matching React component.

---

## Where Things Live

```
src/agentic_platform/
  app/        <-- YOUR CODE. Tools, workflows, blocks, prompts.
  core/       <-- Framework. Don't touch unless you're building engine features.
  api/        <-- HTTP layer. Routes, SSE streaming, AG-UI projection.
```

Frontend: `src/features/chatv2/components/blocks/` -- your block components go here.

---

## Adding a Tool

A tool is a function the LLM can call. You need three things: the function, a wrapper, and registration.

```python
# app/campaigns/tools/my_tool.py
from langchain_core.tools import tool
from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag

@tool("get_campaign_roi")
async def _get_campaign_roi(campaign_id: str) -> dict:
    """Get ROI metrics for a campaign. Call this when the user asks
    about campaign performance, returns, or efficiency."""
    data = await fetch_roi(campaign_id)
    return ToolResponse(
        summary=f"Campaign {campaign_id}: {data['roi']}% ROI, ${data['spend']} spent",
        data=data,
    ).model_dump()

get_campaign_roi = AgenticTool(
    func=_get_campaign_roi,
    thinking_messages=["Pulling ROI data..."],
    tags=[ToolTag.ANALYTICS],
)
```

Register it:

```python
# app/campaigns/agent.py
config = AgentConfig(
    ...
    tools=[get_campaign_roi, ...],
)
```

**The docstring is everything.** The LLM reads it to decide when to call your tool. Write it like you're explaining to a smart coworker when this tool is useful.

**`summary`** goes to the LLM for reasoning. **`ui_blocks`** go to the frontend for display. **`data`** goes to the LLM as structured JSON.

### Adding Rich UI to a Tool

If you want your tool to render a card/table/widget instead of just text:

```python
# 1. Define the block schema (app/campaigns/blocks.py)
from src.agentic_platform.core.engine import BlockSpec, register_block_spec, BlockDisplay

class ROIData(BaseModel):
    campaign_id: str
    roi_percent: float
    spend: float

roi_block = register_block_spec(BlockSpec(
    block_type="campaign_roi",        # Must match frontend BLOCK_REGISTRY key
    data_schema=ROIData,
    display=BlockDisplay.INLINE,      # INLINE | SIDEBAR | MODAL | FULLSCREEN
))

# 2. Emit it from your tool
return ToolResponse(
    summary=f"ROI is {data['roi']}%",
    ui_blocks=[roi_block.create(data=ROIData(**data))],
).model_dump()
```

```tsx
// 3. Frontend: features/chatv2/components/blocks/CampaignROI.tsx
export function CampaignROI({ data }) {
  return <div className="rounded-lg border p-4">ROI: {data.roi_percent}%</div>
}

// 4. Register: features/chatv2/components/blocks/BlockRegistry.tsx
campaign_roi: { inline: CampaignROI },
```

That's it. Backend emits the block, frontend renders it. The `block_type` string is the only coupling.

**Display modes:**
- **inline** -- renders directly in the chat message
- **sidebar** -- clickable card that opens a right panel
- **modal** -- clickable card that opens a dialog
- **fullscreen** -- clickable card that takes the full viewport

For sidebar/modal/fullscreen, you create two components: a trigger (the card in chat) and the content (what opens).

<div style="page-break-before: always;"></div>

## Adding a Workflow

Workflows are for multi-step operations like "create a campaign" -- research, analyze, plan, build, save.

```python
# app/campaigns/workflows/create_campaign.py
from langchain_core.tools import tool
from src.agentic_platform.core.engine import (
    AgenticWorkflow, Step, Parallel, SubStep, WorkflowContext, NodeResponse,
)

# 1. Trigger tool -- LLM calls this to start the workflow
@tool("create_media_plan")
async def _create_media_plan(url: str, budget: float) -> dict:
    """Create a full media plan for an advertiser. Use when the user
    wants to create or build a new campaign."""
    raise NotImplementedError  # Framework routes to the workflow graph

# 2. Step functions -- each receives WorkflowContext
async def research(ctx: WorkflowContext) -> NodeResponse:
    data = await scrape(ctx.args["url"])
    return NodeResponse(summary=f"Scraped {len(data)} pages", data=data)

async def analyze(ctx: WorkflowContext) -> NodeResponse:
    # Access prior step results
    scraped = ctx.results["research"].data
    # Report substep progress
    ctx.progress.start("market")
    market = await analyze_market(scraped)
    ctx.progress.done("market", summary="3 competitors found")
    # Emit an artifact (shows in insights sidebar)
    ctx.emit_artifact(StepArtifact(type="market_context", title="Market", data=market))
    return NodeResponse(summary="Analysis complete", data=market)

# 3. Assemble the workflow
create_media_plan = AgenticWorkflow(
    trigger=_create_media_plan,
    title="Creating media plan for {url}",
    steps=[
        Step("research", research, label="Research website"),
        Step("analyze", analyze, label="Analyze market", substeps=[
            SubStep("market", "Market analysis"),
            SubStep("brand", "Brand analysis"),
        ]),
        Step("plan", plan_step, label="Generate plan"),
        Step("save", save_step, label="Save"),
    ],
)
```

Register it:

```python
# app/campaigns/agent.py
config = AgentConfig(
    ...
    workflows=[create_media_plan],
)
```

**Key things in WorkflowContext:**
- `ctx.args` -- trigger arguments (`{"url": "...", "budget": 50000}`)
- `ctx.results` -- prior step outputs (`{"research": NodeResponse(...)}`)
- `ctx.progress` -- substep progress (`ctx.progress.start("market")`, `ctx.progress.done("market")`)
- `ctx.emit_artifact(...)` -- structured insights for the sidebar
- `ctx.org_id`, `ctx.user_id` -- current user context

### HITL in Workflows

To pause and ask the user for input:

```python
from src.agentic_platform.core.engine import HITLRequest, HITLActionButton, HITLField, HITLAction

async def configure(ctx: WorkflowContext) -> NodeResponse:
    plan = ctx.results["plan"].data
    return NodeResponse(
        summary="Ready for review",
        data=plan,
        hitl=HITLRequest(
            type="form",
            title="Review campaign settings",
            fields=[
                HITLField(name="budget", label="Budget", type="number", default=plan["budget"]),
                HITLField(name="start_date", label="Start Date", type="date"),
            ],
            actions=[
                HITLActionButton(action=HITLAction.SUBMIT, label="Approve", style="primary"),
                HITLActionButton(action=HITLAction.REJECT, label="Cancel"),
            ],
        ),
    )
```

The workflow pauses, the frontend renders the form, the user submits, and the next step picks up with `ctx.results["configure"].metadata["user_input"]`.

<div style="page-break-before: always;"></div>

## The System Prompt

The system prompt defines your agent's personality and rules. It lives in `app/<domain>/prompts/system.py`:

```python
SYSTEM_PROMPT = """You are the Campaign Assistant for {org_name}.

## Your Tools
- **create_media_plan**: Use when the user wants to CREATE a new campaign.
  Always ask for the website URL and budget before calling.
- **get_campaign_details**: Use for questions about a SPECIFIC campaign.

## Rules
- Never make up data. If a tool returns empty results, say so.
- Keep responses under 3 sentences unless the user asks for detail.
"""
```

**Dynamic context** adds per-request info (like the user's connected ad platforms):

```python
def campaign_dynamic_context(user) -> str:
    platforms = user.domain_context.get("platforms", [])
    if platforms:
        return f"Connected platforms: {', '.join(p.name for p in platforms)}"
    return "No ad platforms connected yet."
```

---

## Adding a New Agent

```python
# 1. Create app/my_domain/agent.py
config = AgentConfig(
    agent_id="my-agent",
    name="My Agent",
    system_prompt="You are...",
    tools=[my_tool],
    workflows=[my_workflow],
)

# 2. Register in app/__init__.py
def get_all_agent_configs():
    from src.agentic_platform.app.campaigns.agent import config as campaigns
    from src.agentic_platform.app.my_domain.agent import config as my_agent
    return [campaigns, my_agent]
```

The agent is now available at `/api/v1/agents/my-agent/chat/`.

<div style="page-break-before: always;"></div>

## Frontend Quick Reference

### How Streaming Works

```
User sends message
  -> POST /api/chatv2/agents/{id}/chat/{conv}
  -> BFF adds JWT + org headers, pipes SSE to browser
  -> sseParser splits raw text into AG-UI events
  -> Redux reducer (chatSlice.ts) processes each event:

    RUN_STARTED          ->  streaming = true
    TEXT_MESSAGE_CONTENT  ->  append to streamingText
    STEP_STARTED/FINISHED ->  update activeSteps
    ACTIVITY_SNAPSHOT     ->  set workflow (progress card)
    ACTIVITY_DELTA        ->  patch workflow (step status change)
    CUSTOM (block)        ->  append to streamingBlocks
    CUSTOM (hitl_request) ->  set pendingHITL, pause
    RUN_FINISHED          ->  commit message, streaming = false
```

### Adding a Frontend Block

```tsx
// 1. Create component
export function MyBlock({ data }: { data: MyData }) {
  return <div>{data.title}</div>
}

// 2. Register in BlockRegistry.tsx
my_block_type: { inline: MyBlock },
```

For sidebar blocks, register both a trigger and content:
```tsx
my_details: {
  inlineTrigger: MyDetailsTrigger,   // clickable card in chat
  sidebar: MyDetailsContent,          // opens in right panel
},
```

### Adding an Artifact Renderer

```tsx
// components/workflow/artifact-renderers/MyRenderer.tsx
export function MyRenderer({ data }) { return <div>...</div> }

// Register in artifact-renderers/index.ts
my_artifact_type: MyRenderer,
```

<div style="page-break-before: always;"></div>

## Rules of the Road

| Rule | Why |
|------|-----|
| Tool docstring = tool's contract with the LLM | Bad docstring = LLM calls it at wrong times |
| Always return `ToolResponse(...).model_dump()` | Framework handles all streaming |
| `summary` for LLM, `ui_blocks` for humans | LLM never sees blocks, humans see both |
| Never use `os.getenv()`, use `settings.xxx` | Single source of truth in `core/config.py` |
| Never create HTTP clients, use `ServiceClient` | Circuit breakers, retries, metrics |
| `block_type` string must match frontend registry | Only coupling between backend and frontend |
| Tool name in `@tool("name")` -- no underscores | Function name `_name` with underscore (convention) |

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| LLM never calls my tool | Is the docstring clear? Is it registered in AgentConfig? |
| Block not rendering | Does `block_type` match `BLOCK_REGISTRY` key exactly? |
| SSE stream drops | Check BFF proxy. Is `REACT_AGENTIC_SERVICE_URL` set? |
| HITL not pausing | Is `NodeResponse.hitl` set? Is it an `HITLRequest` instance? |
| Workflow steps not updating | Check `ACTIVITY_DELTA` events in browser Network tab |
| Tool timeout | Default is 60s. Set `AgenticTool(timeout=120)` for slow tools |
| Config not picked up | Added to `core/config.py` Settings class? In `.env`? |

### Quick Debug

```bash
# Health check
curl http://localhost:8080/health

# List agents
curl http://localhost:8080/api/v1/agents/ | jq

# Block schemas (verify your block is registered)
curl http://localhost:8080/api/v1/block-schemas | jq

# Send a test message
curl -N http://localhost:8080/api/v1/agents/campaign-assistant/chat/ \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"1","role":"user","content":"hello"}],"threadId":"t","runId":"r"}'
```

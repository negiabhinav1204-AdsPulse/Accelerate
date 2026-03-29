# Campaign Domain

Campaign management agent: analytics, details, budget proposals, and full campaign creation workflow.

## Agent Config (`agent.py`)

```python
AgentConfig(
    agent_id="campaign-assistant",
    name="Campaign Assistant",
    system_prompt=SYSTEM_PROMPT,              # prompts/system.py
    dynamic_context=campaign_dynamic_context,  # Appends connected platforms per-request
    hydrate_context=hydrate_campaign_context,  # Fetches user's ad platforms from campaign-service
    tools=[generate_image],                    # Shared tool from app/common
    workflows=[create_media_plan],             # Multi-step campaign creation
    model=settings.campaign_agent_model,       # Default: "sonnet"
    mcp_servers=mcp_servers("bigquery_analytics"),  # BigQuery analytics via MCP
)
```

## Tools (`tools/`)

| Tool | Purpose | Block Type | Display |
|------|---------|------------|---------|
| `demo_query_analytics` | Campaign performance data | `campaign_overview` | INLINE |
| `get_campaign_details` | Single campaign deep dive | `campaign_details` | SIDEBAR |
| `propose_budget_changes` | Budget reallocation | `budget_approval` | MODAL |
| MCP: BigQuery analytics | SQL queries on ad data | — (text summary) | — |

Shared: `generate_image` from `app/common/` (multi-provider image generation).

## Blocks (`blocks.py`)

| block_type | Display | Data Model | Trigger Model |
|------------|---------|------------|---------------|
| `campaign_overview` | INLINE | CampaignOverviewData | — |
| `campaign_details` | SIDEBAR | CampaignDetailData | CampaignDetailTrigger |
| `budget_approval` | MODAL | BudgetApprovalData | BudgetApprovalTrigger |

## Workflow: create_media_plan (`workflows/`)

6-step pipeline for creating campaigns from a website URL + budget:

| Step | File | Key Actions |
|------|------|-------------|
| `scrape` | `steps/scrape.py` | Scrape website, extract products/brand |
| `analyze` | `steps/analyze.py` | LLM analysis (market, brand, audience) with substeps + artifacts |
| `configure` | `steps/configure.py` | **HITL form** — user reviews/edits campaign settings |
| `plan` | `steps/plan.py` | Generate media plan (platform allocation, budgets) |
| `build` | `steps/build.py` | Build campaigns (text assets, targeting, keywords) |
| `save` | `steps/save.py` | Persist to campaign-service API |

### Workflow Step Patterns Used
- **SubSteps:** `analyze` uses `ctx.progress.start/done` for parallel LLM calls
- **Artifacts:** `analyze` emits `StepArtifact` for market/brand/audience insights
- **HITL Form:** `configure` returns `HITLRequest(type="form")`, next step reads `ctx.results["configure"].metadata["user_input"]`
- **Service Calls:** `save` uses `campaign_client` (ServiceClient wrapper) to POST to campaign-service
- **Hidden Step:** `scrape` runs with `hidden=False` but could be hidden for background work

## Services (`services/`)

- **campaign_client.py** — `ServiceClient` wrapper for campaign-service REST API
  - `get_campaigns()`, `create_campaign()`, etc.
  - Reads auth token from `request_auth_token` ContextVar automatically
- **web_scraper.py** — Website content extraction (headless browser + LLM parsing)

## Context (`context.py`)

- `hydrate_campaign_context(user)` — called BEFORE graph execution
  - Fetches user's connected Google/Bing ad accounts from campaign-service
  - Populates `user.domain_context["platforms"]`
- `campaign_dynamic_context(metadata)` — appended to system prompt per-request
  - Lists connected platforms so LLM knows what's available

## Models (`models/`)

Pydantic models for domain data: campaign requests, analysis results, strategy, media plans, text assets, platform connections, workflow I/O.

## Prompts (`prompts/`)

- `system.py` — Main system prompt + dynamic context function
- `analysis.py` — LLM prompts for market/brand/audience analysis
- `strategy.py` — Campaign strategy generation
- `plan.py` — Media plan allocation
- `text_assets.py` — Ad copy generation
- `image.py` — Image prompt generation
- `enrichment.py` — Data enrichment prompts

## Adding a New Campaign Tool

1. Create `tools/my_tool.py` with `@tool` + `AgenticTool`
2. (Optional) Add `BlockSpec` to `blocks.py`
3. Add to `config.tools` list in `agent.py`
4. Update system prompt in `prompts/system.py` to tell the LLM when to use it

## Adding a New Workflow Step

1. Create `workflows/steps/my_step.py` with `async def my_step(ctx) -> NodeResponse`
2. Add `Step("my_step", my_step, ...)` to the workflow's `steps` list in `workflows/create_campaign.py`
3. Prior step results available via `ctx.results["prior_step"].data`

# Chat API Layer

AG-UI SSE streaming, chat persistence, and conversation management. This is the transport layer — it consumes the generic `core/execution.py` output and projects it into AG-UI protocol events.

## How Streaming Works

```
api/chat/routes.py::chat()
  -> persists user message via Persistence
  -> calls run_chat_stream() from orchestration.py
  -> returns StreamingResponse (SSE)

api/chat/orchestration.py::run_chat_stream()
  -> builds graph config via core/execution.build_graph_config()
  -> builds graph input via core/execution.build_graph_input()
  -> iterates core/execution.execute_graph() (raw LangGraph chunks)
  -> project_chunk() maps each chunk to AG-UI events
  -> StreamReducer accumulates events for persistence
  -> sse_encode() serializes to SSE wire format
  -> on stream end: _flush_snapshot() persists to db-service
```

## AG-UI Event Types Emitted

| Event | When |
|-------|------|
| `RUN_STARTED` | Stream begins |
| `TEXT_MESSAGE_START/CONTENT/END` | LLM generates text response |
| `REASONING_MESSAGE_CHUNK` | LLM thinking indicator |
| `STEP_STARTED` / `STEP_FINISHED` | Tool execution boundaries |
| `ACTIVITY_SNAPSHOT` | Workflow initial state (full tree) |
| `ACTIVITY_DELTA` | Workflow step status change (JSON Patch) |
| `CUSTOM` | UI blocks, HITL requests, workflow progress |
| `RUN_FINISHED` / `RUN_ERROR` | Stream ends |

## Key Components

### routes.py
Chat endpoints as FastAPI router (mounted at `/api/v1/`):
- `POST /agents/{id}/chat/{conv_id}` — send message, get SSE stream
- `GET /agents/{id}/conversations/{conv_id}/messages` — get persisted messages + hydrated workflows
- `GET /agents/{id}/conversations/latest` — most recent conversation for user+org
- `POST /agents/{id}/conversations` — create empty conversation

### orchestration.py
- `run_chat_stream()` — main streaming function
- `project_chunk()` — maps LangGraph chunks to AG-UI events (stateless)
- `_flush_snapshot()` — persists reducer state to db-service after stream ends
- `_langfuse_trace()` — Langfuse tracing context manager
- `_active_runs` — in-memory dict for SSE reconnection (tab recovery)

### persistence.py
REST client for `accelerate-db-service` at `/agentic-chat/` endpoints:
- Conversations: create, get, get_or_create, get_latest
- Messages: add, get_messages
- Workflows: create, update, get_active
- HITL: update_hitl_block

### stream_reducer.py
Folds AG-UI events into a `StreamSnapshot` for persistence:
- Accumulates text, blocks, workflow state
- Tracks run status (RUNNING, INTERRUPTED, ERROR)
- `to_db_blocks()` — converts to persistence format

## DO NOT
- Do not import from `api/chat/` in `app/` or `core/`
- Do not add domain-specific logic here — this is transport only
- Do not create new event types — use the AG-UI protocol events
- Do not persist messages from tools — `_flush_snapshot()` handles it

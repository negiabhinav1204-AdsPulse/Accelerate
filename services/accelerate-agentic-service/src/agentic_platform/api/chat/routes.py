"""Chat API routes — AG-UI compliant SSE streaming + conversation management.

All chat-specific endpoints live here. The main server.py includes this
router at /api/v1/agents/{agent_id}/.
"""

import logging
from uuid import uuid4

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse

from ag_ui.core import RunAgentInput

from src.agentic_platform.core.infra.http_client.exceptions import HTTPStatusError
from src.agentic_platform.core.agents.loader import LoadedAgent
from src.agentic_platform.api.chat.orchestration import run_chat_stream
from src.agentic_platform.api.sse import content_type

logger = logging.getLogger(__name__)

router = APIRouter()

SSE_HEADERS = {"Cache-Control": "no-cache", "Connection": "keep-alive"}


def _get_agent(request: Request, agent_id: str) -> LoadedAgent:
    agent = request.app.state.agents.get(agent_id)
    if not agent:
        available = list(request.app.state.agents.keys())
        raise HTTPException(404, f"Agent '{agent_id}' not found. Available: {available}")
    return agent


def _extract_user_message(body: RunAgentInput) -> str | None:
    """Extract the latest user message text from AG-UI RunAgentInput."""
    if not body.messages:
        return None
    last = body.messages[-1]
    if last.role != "user":
        return None
    if isinstance(last.content, str):
        return last.content
    # Multimodal content blocks — extract text
    for block in last.content:
        if hasattr(block, "text"):
            return block.text
    return None


# ── Chat streaming ──────────────────────────────────────────────────

@router.post("/agents/{agent_id}/chat/{conv_id}")
@router.post("/agents/{agent_id}/chat/")
async def chat(request: Request, agent_id: str, body: RunAgentInput, conv_id: str | None = None):
    """Send a message to a specific agent. Returns AG-UI SSE stream."""
    user = request.state.user
    agent = _get_agent(request, agent_id)

    # Domain-specific context hydration
    if user and agent.config.hydrate_context:
        await agent.config.hydrate_context(user)

    # Thread ID: URL path takes priority → AG-UI body → auto-generate
    conv_id = conv_id or body.thread_id or str(uuid4())

    user_message = _extract_user_message(body)

    # Check for HITL response in state
    hitl_response = body.state.get("hitl_response") if isinstance(body.state, dict) else None

    if user_message:
        try:
            await agent.persistence.get_or_create_conversation(
                conv_id,
                user_id=(user.user_id if user else None) or "anonymous",
                org_id=(user.org_id if user else None) or "default",
            )
            await agent.persistence.add_message(
                conv_id, "user", [{"type": "text", "content": user_message}],
            )
        except Exception as e:
            logger.warning("Failed to persist user message for conv %s: %s", conv_id, e)

    # Check for workflow reconnection (page reload / tab recovery)
    resume_workflow = False
    if not user_message and not hitl_response:
        resume_state = body.state.get("resume_workflow") if isinstance(body.state, dict) else None
        if resume_state:
            resume_workflow = True

    return StreamingResponse(
        run_chat_stream(
            graph=agent.graph,
            persistence=agent.persistence,
            conv_id=conv_id,
            user_message=user_message,
            hitl_response=hitl_response,
            user=user,
            agent_config=agent.config,
            resume_workflow=resume_workflow,
        ),
        media_type=content_type(),
        headers=SSE_HEADERS,
    )


# ── Conversations ───────────────────────────────────────────────────

@router.get("/agents/{agent_id}/conversations/{conv_id}/messages")
async def get_messages(request: Request, agent_id: str, conv_id: str):
    """Retrieve messages and workflows for a conversation.

    Hydrates workflow_progress references with full activity data.
    Returns empty results for conversations that don't exist yet.
    """
    user = request.state.user
    agent = _get_agent(request, agent_id)

    # Org-scoping: verify the conversation belongs to the requester's org
    try:
        conversation = await agent.persistence.get_conversation(conv_id)
        conv_org = conversation.get("org_id", "")
        requester_org = user.org_id if user else ""
        if conv_org and requester_org and conv_org != requester_org:
            raise HTTPException(403, "You don't have access to this conversation")
    except HTTPStatusError as e:
        if e.status_code == 404:
            return {"messages": [], "workflows": []}
        raise

    try:
        messages = await agent.persistence.get_messages(conv_id)
    except HTTPStatusError as e:
        if e.status_code == 400:
            return {"messages": [], "workflows": []}
        raise
    try:
        workflows = await agent.persistence.get_active_workflows(conv_id)
    except Exception as e:
        logger.warning("Failed to fetch workflows for conv %s: %s", conv_id, e)
        workflows = []

    # Hydrate workflow_progress references in message blocks
    if workflows:
        wf_lookup = {wf["id"]: wf for wf in workflows if "id" in wf}
        for msg in messages:
            blocks = msg.get("blocks", [])
            for block in blocks:
                if block.get("type") == "workflow_progress" and "workflow_id" in block:
                    wf = wf_lookup.get(block["workflow_id"])
                    if wf:
                        block["data"] = wf.get("activity_content", {})

    return {"messages": messages, "workflows": workflows}


@router.get("/agents/{agent_id}/conversations/latest")
async def get_latest_conversation(request: Request, agent_id: str):
    """Get the most recent conversation for the authenticated user+org."""
    user = request.state.user
    agent = _get_agent(request, agent_id)

    try:
        conversation = await agent.persistence.get_latest_conversation(
            user_id=(user.user_id if user else None) or "anonymous",
            org_id=(user.org_id if user else None) or "",
        )
        return {"conversation_id": conversation.get("id") if conversation else None}
    except Exception as e:
        logger.warning("Failed to fetch latest conversation: %s", e)
        return {"conversation_id": None}


@router.post("/agents/{agent_id}/conversations")
async def create_conversation(request: Request, agent_id: str):
    """Create a new empty conversation."""
    user = request.state.user
    agent = _get_agent(request, agent_id)

    conv_id = str(uuid4())
    try:
        conversation = await agent.persistence.create_conversation(
            conversation_id=conv_id,
            user_id=(user.user_id if user else None) or "anonymous",
            org_id=(user.org_id if user else None) or "default",
        )
        return {"conversation_id": conversation.get("id", conv_id)}
    except Exception as e:
        logger.warning("Failed to persist conversation creation: %s", e)
        return {"conversation_id": conv_id}

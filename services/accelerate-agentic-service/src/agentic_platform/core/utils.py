"""Shared utilities."""


def normalize_content(content) -> str:
    """Normalize LLM message content to a plain string.

    Some providers (Anthropic) return content as a list of content blocks
    like [{"type": "text", "text": "..."}] instead of a plain string.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b.get("text", "") if isinstance(b, dict) else str(b)
            for b in content
        )
    return str(content) if content else ""

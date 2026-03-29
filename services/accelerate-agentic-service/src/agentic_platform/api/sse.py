"""SSE encoding via AG-UI protocol."""

from ag_ui.encoder import EventEncoder

_encoder = EventEncoder()


def sse_encode(event) -> str:
    """Encode an AG-UI event as an SSE data line."""
    return _encoder.encode(event)


def content_type() -> str:
    """MIME type for StreamingResponse."""
    return _encoder.get_content_type()

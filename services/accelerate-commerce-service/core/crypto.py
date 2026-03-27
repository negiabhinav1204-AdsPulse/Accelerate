"""AES-256-GCM encryption for connector credentials stored in the DB."""
from __future__ import annotations

import base64
import json
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _get_key() -> bytes:
    raw = os.environ.get("CREDENTIALS_ENCRYPTION_KEY", "")
    if not raw:
        # Dev fallback — 32 zero bytes (NOT for production)
        return b"\x00" * 32
    key_bytes = base64.b64decode(raw)
    if len(key_bytes) != 32:
        raise ValueError("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (base64-encoded 256-bit key)")
    return key_bytes


def encrypt_credentials(data: dict) -> str:
    """Encrypt a credentials dict to a base64-encoded string."""
    key = _get_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    plaintext = json.dumps(data).encode()
    ct = aesgcm.encrypt(nonce, plaintext, None)
    return base64.b64encode(nonce + ct).decode()


def decrypt_credentials(encrypted: str | dict) -> dict:
    """Decrypt a base64 string back to credentials dict."""
    if isinstance(encrypted, dict):
        return encrypted  # already decrypted (dev/test path)
    key = _get_key()
    aesgcm = AESGCM(key)
    raw = base64.b64decode(encrypted)
    nonce, ct = raw[:12], raw[12:]
    plaintext = aesgcm.decrypt(nonce, ct, None)
    return json.loads(plaintext)

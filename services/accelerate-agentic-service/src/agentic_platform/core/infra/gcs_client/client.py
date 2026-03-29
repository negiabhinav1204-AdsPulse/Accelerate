"""GCSClient — truly async GCS upload using gcloud-aio-storage.

Content-addressed: SHA-256 hash as filename -> dedup + immutable CDN cache.
Path: {prefix}/assets/{org_id}/{asset_type}/{sha256}.{ext}

Config via settings (config.py):
    gcs_bucket_name, gcs_cdn_base_url, gcs_path_prefix
"""

import asyncio
import hashlib
import logging
from typing import Optional

from gcloud.aio.storage import Storage

from src.agentic_platform.core.config import settings

logger = logging.getLogger(__name__)


def _detect_content_type(data: bytes) -> tuple[str, str]:
    """Detect MIME type and extension from magic bytes."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png", "png"
    if data[:2] == b"\xff\xd8":
        return "image/jpeg", "jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    if data[:3] in (b"GIF", b"GIF"):
        return "image/gif", "gif"
    # Default to PNG
    return "image/png", "png"


class GCSClient:
    """Truly async GCS upload using gcloud-aio-storage.

    Content-addressed: SHA-256 hash as filename -> dedup + immutable CDN cache.
    Path: {prefix}/assets/{org_id}/{asset_type}/{sha256}.{ext}

    Reads config from settings (Pydantic Settings) — safe at import time.
    """

    @property
    def _bucket(self) -> str:
        return settings.gcs_bucket_name

    @property
    def _cdn_base(self) -> str:
        return settings.gcs_cdn_base_url.rstrip("/")

    @property
    def _prefix(self) -> str:
        return settings.gcs_path_prefix.strip("/")

    def _build_path(self, sha: str, ext: str, org_id: str, asset_type: str) -> str:
        parts = [self._prefix, "assets", org_id, asset_type, f"{sha}.{ext}"]
        return "/".join(p for p in parts if p)

    def _build_url(self, gcs_path: str) -> str:
        return f"{self._cdn_base}/{gcs_path}"

    async def upload(
        self,
        image_bytes: bytes,
        org_id: str,
        asset_type: str = "generated_images",
    ) -> Optional[str]:
        """Upload bytes -> return CDN URL. Skips if object already exists (dedup)."""
        if not self._bucket:
            logger.error("GCS not configured (GCS_BUCKET_NAME is empty)")
            return None

        try:
            content_type, ext = _detect_content_type(image_bytes)
            sha = hashlib.sha256(image_bytes).hexdigest()
            gcs_path = self._build_path(sha, ext, org_id, asset_type)

            async with Storage() as client:
                # Check if object exists (dedup)
                try:
                    await client.download(self._bucket, gcs_path)
                    logger.debug("Dedup hit: %s already exists", gcs_path)
                    return self._build_url(gcs_path)
                except Exception:
                    pass  # Object doesn't exist, proceed with upload

                await client.upload(
                    self._bucket,
                    gcs_path,
                    image_bytes,
                    headers={"Content-Type": content_type},
                )

            url = self._build_url(gcs_path)
            # Log size + filename only (not full CDN URL)
            short = gcs_path.rsplit("/", 1)[-1] if "/" in gcs_path else gcs_path
            logger.info("Uploaded %d bytes -> %s", len(image_bytes), short)
            return url

        except Exception:
            logger.exception("GCS upload failed")
            return None

    async def upload_many(
        self,
        items: list[tuple[bytes, str]],
        org_id: str,
        asset_type: str = "generated_images",
    ) -> list[Optional[str]]:
        """Batch upload via asyncio.gather(). Items are (image_bytes, _unused_hint)."""
        return list(await asyncio.gather(
            *(self.upload(data, org_id, asset_type) for data, _ in items)
        ))

    async def download(self, cdn_url: str) -> Optional[bytes]:
        """Download image from CDN URL (for multi-turn editing)."""
        try:
            # Extract GCS path from CDN URL
            path = cdn_url.replace(self._cdn_base + "/", "", 1)
            async with Storage() as client:
                return await client.download(self._bucket, path)
        except Exception:
            logger.exception("GCS download failed for %s", cdn_url)
            return None

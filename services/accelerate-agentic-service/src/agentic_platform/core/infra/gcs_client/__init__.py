"""
Async GCS Client Module.

Truly async image upload to GCS via gcloud-aio-storage.
Content-addressed: SHA-256 hash as filename -> dedup + immutable CDN cache.

Primary API:
    from src.agentic_platform.core.infra.gcs_client import GCSClient

    gcs = GCSClient()
    cdn_url = await gcs.upload(image_bytes, org_id="org123")

Env vars (mandatory):
    GCS_BUCKET_NAME, GCS_CDN_BASE_URL, GCS_PATH_PREFIX
"""

from .client import GCSClient

__all__ = ["GCSClient"]

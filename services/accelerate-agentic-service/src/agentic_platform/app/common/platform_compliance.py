"""Platform compliance — image slot policies for Meta, Google, Bing, TikTok, LinkedIn.

Extracted from the ACE spec (Ad Creative Compositing Engine). Kept deliberately
lean: no Puppeteer, no template compositing, no text overlay. Just slot definitions
and post-generation validation (resolution + file size + aspect ratio).

Usage in build.py:
    from src.agentic_platform.app.common.platform_compliance import validate_image_bytes

    violations = validate_image_bytes(image_bytes, template_type="META_SINGLE_IMAGE_AD", slot_name="marketingImages")
    if violations:
        # retry / recompress / fall back to product image
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SlotPolicy:
    """Compliance rules for a single image slot on a platform."""
    min_width: int          # pixels
    min_height: int         # pixels
    max_file_size_bytes: int
    aspect_ratio_tolerance: float = 0.05  # fraction — e.g. 0.05 = ±5%
    recommended_width: int = 0
    recommended_height: int = 0


# ─────────────────────────────────────────────────────────────────────────────
# Policy registry — keyed by (template_type_value, slot_name)
# Sources:
#   Meta:     https://www.facebook.com/business/help/103816146375288
#   Google:   https://support.google.com/google-ads/answer/10724606  (PMax)
#             https://support.google.com/google-ads/answer/1722043   (Display)
#   Bing:     https://help.ads.microsoft.com/apex/index/3/en/60144   (PMax)
#   TikTok:   https://ads.tiktok.com/help/article/image-ads-specs
#   LinkedIn: https://business.linkedin.com/marketing-solutions/native-advertising/specs
# ─────────────────────────────────────────────────────────────────────────────
SLOT_POLICIES: dict[tuple[str, str], SlotPolicy] = {

    # ── Meta ─────────────────────────────────────────────────────────────────
    # Single Image Ad — feed landscape
    ("META_SINGLE_IMAGE_AD", "marketingImages"): SlotPolicy(
        min_width=600, min_height=315,
        max_file_size_bytes=30_000_000,   # 30 MB
        aspect_ratio_tolerance=0.03,
        recommended_width=1200, recommended_height=628,
    ),
    # Single Image Ad — feed square
    ("META_SINGLE_IMAGE_AD", "squareMarketingImages"): SlotPolicy(
        min_width=600, min_height=600,
        max_file_size_bytes=30_000_000,
        aspect_ratio_tolerance=0.03,
        recommended_width=1200, recommended_height=1200,
    ),
    # Single Image Ad — Stories / Reels (9:16)
    ("META_SINGLE_IMAGE_AD", "storyImages"): SlotPolicy(
        min_width=500, min_height=889,
        max_file_size_bytes=30_000_000,
        aspect_ratio_tolerance=0.05,
        recommended_width=1080, recommended_height=1920,
    ),
    # Carousel — always square
    ("META_CAROUSEL_AD", "carouselImages"): SlotPolicy(
        min_width=600, min_height=600,
        max_file_size_bytes=30_000_000,
        aspect_ratio_tolerance=0.03,
        recommended_width=1080, recommended_height=1080,
    ),
    # Collection — cover image (landscape) + catalog images (square)
    ("META_COLLECTION_AD", "coverImage"): SlotPolicy(
        min_width=600, min_height=315,
        max_file_size_bytes=30_000_000,
        aspect_ratio_tolerance=0.03,
        recommended_width=1200, recommended_height=628,
    ),
    ("META_COLLECTION_AD", "catalogImages"): SlotPolicy(
        min_width=600, min_height=600,
        max_file_size_bytes=30_000_000,
        aspect_ratio_tolerance=0.03,
        recommended_width=1080, recommended_height=1080,
    ),

    # ── Google ───────────────────────────────────────────────────────────────
    # Performance Max — landscape
    ("GOOGLE_PERFORMANCE_MAX", "marketingImages"): SlotPolicy(
        min_width=600, min_height=314,
        max_file_size_bytes=5_242_880,    # 5 MB
        aspect_ratio_tolerance=0.05,
        recommended_width=1200, recommended_height=628,
    ),
    # Performance Max — square
    ("GOOGLE_PERFORMANCE_MAX", "squareMarketingImages"): SlotPolicy(
        min_width=300, min_height=300,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=1200, recommended_height=1200,
    ),
    # Performance Max — portrait (4:5)
    ("GOOGLE_PERFORMANCE_MAX", "portraitMarketingImages"): SlotPolicy(
        min_width=480, min_height=600,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=960, recommended_height=1200,
    ),
    # Responsive Display — landscape
    ("GOOGLE_RESPONSIVE_DISPLAY_AD", "marketingImages"): SlotPolicy(
        min_width=600, min_height=314,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=1200, recommended_height=628,
    ),
    # Responsive Display — square
    ("GOOGLE_RESPONSIVE_DISPLAY_AD", "squareMarketingImages"): SlotPolicy(
        min_width=300, min_height=300,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=1200, recommended_height=1200,
    ),

    # ── Bing / Microsoft Advertising ─────────────────────────────────────────
    # PMax — landscape
    ("BING_PERFORMANCE_MAX", "marketingImages"): SlotPolicy(
        min_width=703, min_height=368,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=1200, recommended_height=628,
    ),
    # PMax — square
    ("BING_PERFORMANCE_MAX", "squareMarketingImages"): SlotPolicy(
        min_width=470, min_height=470,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=1200, recommended_height=1200,
    ),
    # PMax — vertical (1:2 per Microsoft spec, NOT 4:5)
    ("BING_PERFORMANCE_MAX", "portraitMarketingImages"): SlotPolicy(
        min_width=470, min_height=940,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=600, recommended_height=1200,
    ),
    # Responsive Display
    ("BING_RESPONSIVE_DISPLAY_AD", "images"): SlotPolicy(
        min_width=703, min_height=368,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=1200, recommended_height=628,
    ),

    # ── TikTok (ready for when platform is connected) ──────────────────────
    # In-Feed — vertical (9:16)
    ("TIKTOK_IN_FEED_AD", "videoThumbnail"): SlotPolicy(
        min_width=720, min_height=1280,
        max_file_size_bytes=500_000_000,  # 500 MB (TikTok is generous for images)
        aspect_ratio_tolerance=0.01,       # TikTok is strict: ±1%
        recommended_width=1080, recommended_height=1920,
    ),
    # In-Feed — square
    ("TIKTOK_IN_FEED_AD", "squareImage"): SlotPolicy(
        min_width=640, min_height=640,
        max_file_size_bytes=500_000_000,
        aspect_ratio_tolerance=0.01,
        recommended_width=1080, recommended_height=1080,
    ),

    # ── LinkedIn (ready for when platform is connected) ───────────────────
    # Single Image Ad — landscape
    ("LINKEDIN_SINGLE_IMAGE_AD", "marketingImages"): SlotPolicy(
        min_width=640, min_height=360,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=1200, recommended_height=627,
    ),
    # Single Image Ad — square
    ("LINKEDIN_SINGLE_IMAGE_AD", "squareMarketingImages"): SlotPolicy(
        min_width=360, min_height=360,
        max_file_size_bytes=5_242_880,
        aspect_ratio_tolerance=0.05,
        recommended_width=1200, recommended_height=1200,
    ),
}


def validate_image_bytes(
    image_bytes: bytes,
    template_type: str,
    slot_name: str,
) -> list[str]:
    """Validate generated image bytes against platform policy for the given slot.

    Returns a list of violation strings. Empty list = compliant.
    Returns [] when no policy is defined for the (template_type, slot_name) pair
    (unknown templates pass through — fail-open by design).

    Checks:
    - File size ≤ max_file_size_bytes
    - Width ≥ min_width
    - Height ≥ min_height
    """
    policy = SLOT_POLICIES.get((template_type, slot_name))
    if policy is None:
        return []  # No policy defined — assume compliant

    violations: list[str] = []

    # ── File size ──
    size_bytes = len(image_bytes)
    if size_bytes > policy.max_file_size_bytes:
        violations.append(
            f"file_size {size_bytes // 1024}KB exceeds "
            f"{policy.max_file_size_bytes // 1024}KB limit "
            f"for {template_type}/{slot_name}"
        )

    # ── Resolution ──
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        w, h = img.size
        if w < policy.min_width:
            violations.append(
                f"width {w}px below minimum {policy.min_width}px "
                f"for {template_type}/{slot_name}"
            )
        if h < policy.min_height:
            violations.append(
                f"height {h}px below minimum {policy.min_height}px "
                f"for {template_type}/{slot_name}"
            )
    except Exception as exc:
        logger.debug("[compliance] could not check resolution for %s/%s: %s", template_type, slot_name, exc)

    return violations


def recompress_to_fix_size(
    image_bytes: bytes,
    target_max_bytes: int,
    quality_start: int = 85,
    quality_floor: int = 60,
) -> bytes:
    """JPEG-recompress image_bytes until it fits within target_max_bytes.

    Tries quality levels from quality_start down to quality_floor in steps of 10.
    Returns the recompressed bytes if it fits, or the smallest result otherwise.
    Only useful for file-size violations — resolution violations won't be fixed here.
    """
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode == "RGBA":
            img = img.convert("RGB")

        best: bytes = image_bytes
        for quality in range(quality_start, quality_floor - 1, -10):
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
            candidate = buf.getvalue()
            best = candidate
            if len(candidate) <= target_max_bytes:
                return candidate
        return best
    except Exception as exc:
        logger.warning("[compliance] recompress failed: %s", exc)
        return image_bytes

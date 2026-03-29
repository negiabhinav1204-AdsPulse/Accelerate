import hashlib
import random
from typing import Optional


def is_in_holdout(visitor_id: str, experiment_id: str, holdout_pct: int) -> bool:
    """Deterministic holdout check using SHA256."""
    if holdout_pct <= 0:
        return False
    key = f"{visitor_id}:{experiment_id}:holdout"
    bucket = int(hashlib.sha256(key.encode()).hexdigest(), 16) % 100
    return bucket < holdout_pct


def assign_variant_random(
    visitor_id: str,
    experiment_id: str,
    allocations: list[dict],
) -> Optional[str]:
    """
    Deterministic random assignment based on hash.
    Respects relative weights — weight values are treated as proportional shares.
    Returns variant_id or None.
    """
    if not allocations:
        return None

    total_weight = sum(a.get("weight", 50) for a in allocations)
    if total_weight <= 0:
        return str(allocations[0]["variantId"])

    key = f"{visitor_id}:{experiment_id}"
    bucket = int(hashlib.sha256(key.encode()).hexdigest(), 16) % total_weight
    cumulative = 0
    for alloc in allocations:
        cumulative += alloc.get("weight", 50)
        if bucket < cumulative:
            return str(alloc["variantId"])

    # Fallback — should not reach here
    return str(allocations[-1]["variantId"])


def assign_variant_bandit(
    allocations: list[dict],
    bandit_stats: list[dict],
) -> Optional[str]:
    """
    Thompson Sampling: draw Beta(alpha, beta) per variant and return the
    variant with the highest sample.
    """
    if not allocations:
        return None

    stats_map = {str(s["variantId"]): s for s in bandit_stats}
    best_sample = -1.0
    best_id: Optional[str] = None

    for alloc in allocations:
        vid = str(alloc["variantId"])
        s = stats_map.get(vid, {})
        alpha = max(1, s.get("conversions", 0) + 1)
        beta_param = max(1, s.get("impressions", 0) - s.get("conversions", 0) + 1)
        sample = random.betavariate(alpha, beta_param)
        if sample > best_sample:
            best_sample = sample
            best_id = vid

    return best_id


async def assign_variant(
    visitor_id: str,
    experiment_id: str,
    allocations: list[dict],
    holdout_pct: int,
    allocation_mode: str,
    bandit_stats: list[dict] = [],
) -> Optional[str]:
    """
    Main assignment logic.
    Returns variant_id, or None if visitor is in holdout (serve default).
    """
    if is_in_holdout(visitor_id, experiment_id, holdout_pct):
        return None

    if allocation_mode == "bandit" and bandit_stats:
        return assign_variant_bandit(allocations, bandit_stats)

    return assign_variant_random(visitor_id, experiment_id, allocations)

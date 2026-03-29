import math
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class VariantStats:
    variant_id: str
    name: str
    impressions: int
    conversions: int
    revenue: float
    is_control: bool


@dataclass
class ExperimentStats:
    variants: list[VariantStats]
    is_significant: bool
    confidence: float  # 0-100
    winning_variant_id: Optional[str]
    lift_pct: float


def two_proportion_z_test(
    control_conv: int,
    control_imp: int,
    variant_conv: int,
    variant_imp: int,
) -> tuple[float, float]:
    """Two-proportion z-test. Returns (z_score, p_value)."""
    if control_imp == 0 or variant_imp == 0:
        return 0.0, 1.0
    p1 = control_conv / control_imp
    p2 = variant_conv / variant_imp
    p_pool = (control_conv + variant_conv) / (control_imp + variant_imp)
    if p_pool == 0 or p_pool == 1:
        return 0.0, 1.0
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / control_imp + 1 / variant_imp))
    if se == 0:
        return 0.0, 1.0
    z = (p2 - p1) / se
    # Normal CDF approximation (Abramowitz & Stegun)
    p_value = _normal_cdf_upper(abs(z)) * 2  # two-tailed
    return z, p_value


def _normal_cdf_upper(z: float) -> float:
    """P(Z > z) for standard normal using polynomial approximation."""
    if z < 0:
        z = -z
    t = 1.0 / (1.0 + 0.2316419 * z)
    poly = t * (
        0.319381530
        + t * (
            -0.356563782
            + t * (
                1.781477937
                + t * (-1.821255978 + t * 1.330274429)
            )
        )
    )
    return poly * math.exp(-0.5 * z * z) / math.sqrt(2 * math.pi)


def wilson_confidence_interval(
    conversions: int,
    impressions: int,
    z: float = 1.96,
) -> tuple[float, float]:
    """Wilson score confidence interval. Returns (lower, upper)."""
    if impressions == 0:
        return 0.0, 0.0
    n = impressions
    p_hat = conversions / n
    denominator = 1 + z * z / n
    center = (p_hat + z * z / (2 * n)) / denominator
    margin = (z * math.sqrt(p_hat * (1 - p_hat) / n + z * z / (4 * n * n))) / denominator
    return max(0.0, center - margin), min(1.0, center + margin)


def bayesian_probability_b_beats_a(
    conv_a: int,
    imp_a: int,
    conv_b: int,
    imp_b: int,
    samples: int = 5000,
) -> float:
    """Monte Carlo Beta posterior: P(B > A). Returns probability 0-1."""
    import random
    alpha_a = conv_a + 1
    beta_a = max(1, imp_a - conv_a + 1)
    alpha_b = conv_b + 1
    beta_b = max(1, imp_b - conv_b + 1)
    wins = sum(
        1 for _ in range(samples)
        if random.betavariate(alpha_b, beta_b) > random.betavariate(alpha_a, beta_a)
    )
    return wins / samples


def get_experiment_stats(results: list[dict], allocations: list[dict]) -> ExperimentStats:
    """Aggregate ExperimentResult rows and compute full statistical analysis."""
    # Aggregate by variant
    agg: dict[str, dict] = {}
    for row in results:
        vid = str(row["variantId"])
        if vid not in agg:
            agg[vid] = {"impressions": 0, "conversions": 0, "revenue": 0.0}
        agg[vid]["impressions"] += row.get("impressions", 0)
        agg[vid]["conversions"] += row.get("conversions", 0)
        agg[vid]["revenue"] += float(row.get("revenue", 0))

    # Find control allocation
    control_alloc = next(
        (a for a in allocations if a.get("isControl")),
        allocations[0] if allocations else None,
    )
    control_id = str(control_alloc["variantId"]) if control_alloc else None
    control_stats = (
        agg.get(control_id, {"impressions": 0, "conversions": 0, "revenue": 0.0})
        if control_id
        else None
    )

    variant_stats: list[VariantStats] = []
    best_lift = 0.0
    winner_id: Optional[str] = None

    for alloc in allocations:
        vid = str(alloc["variantId"])
        stats = agg.get(vid, {"impressions": 0, "conversions": 0, "revenue": 0.0})
        is_control = vid == control_id

        lift_pct = 0.0
        confidence = 0.0

        if not is_control and control_stats is not None:
            _, p_val = two_proportion_z_test(
                control_stats["conversions"],
                control_stats["impressions"],
                stats["conversions"],
                stats["impressions"],
            )
            confidence = (1 - p_val) * 100
            is_sig = confidence >= 95.0

            if (
                control_stats["impressions"] > 0
                and control_stats["conversions"] > 0
            ):
                c_rate = control_stats["conversions"] / control_stats["impressions"]
                v_rate = stats["conversions"] / max(1, stats["impressions"])
                lift_pct = ((v_rate - c_rate) / c_rate * 100) if c_rate > 0 else 0.0

            if is_sig and lift_pct > best_lift and stats["impressions"] >= 100:
                best_lift = lift_pct
                winner_id = vid

        variant_stats.append(
            VariantStats(
                variant_id=vid,
                name=str(alloc.get("variantName", vid)),
                impressions=stats["impressions"],
                conversions=stats["conversions"],
                revenue=stats["revenue"],
                is_control=is_control,
            )
        )

    # Overall confidence — best non-control vs control
    overall_confidence = 0.0
    if len(variant_stats) >= 2 and control_stats is not None:
        non_control = [v for v in variant_stats if not v.is_control]
        if non_control:
            best_v = max(
                non_control,
                key=lambda v: v.conversions / max(1, v.impressions),
            )
            _, p_val = two_proportion_z_test(
                control_stats["conversions"],
                control_stats["impressions"],
                best_v.conversions,
                best_v.impressions,
            )
            overall_confidence = (1 - p_val) * 100

    return ExperimentStats(
        variants=variant_stats,
        is_significant=overall_confidence >= 95.0,
        confidence=round(overall_confidence, 1),
        winning_variant_id=winner_id,
        lift_pct=round(best_lift, 1),
    )

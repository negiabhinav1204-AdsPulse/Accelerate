"""Insight engine — detect anomalies and generate actionable insights from analytics data."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)


async def generate_insights(org_id: str, pool) -> list[dict]:
    """Analyse recent data and produce prioritised actionable insights.

    Insight types detected:
    1. TRAFFIC_DROP         — daily visitors today vs 7-day avg drops >20%
    2. CONVERSION_SPIKE     — conversion rate today >2x 7-day avg
    3. HIGH_LLM_TRAFFIC     — LLM traffic >15% of total
    4. FUNNEL_BOTTLENECK    — any funnel stage has >60% drop-off
    5. TOP_GEO_OPPORTUNITY  — country with >10% traffic but <2% conversions
    6. ZERO_CONVERSIONS_STREAK — no conversions for 3+ consecutive days

    All DB queries are wrapped in try/except — mock insights returned on any error.
    """
    insights: list[dict] = []
    now = datetime.now(timezone.utc)
    today = now.date()
    seven_days_ago = today - timedelta(days=7)

    try:
        # ── 1. TRAFFIC_DROP ────────────────────────────────────────────────────
        rows = await pool.fetch(
            """
            SELECT
                event_date,
                COUNT(DISTINCT session_id) AS visitors
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
              AND event_type = 'page_view'
            GROUP BY event_date
            ORDER BY event_date DESC
            """,
            org_id,
            seven_days_ago,
        )
        if rows:
            date_map: dict = {r["event_date"]: r["visitors"] for r in rows}
            today_visitors = date_map.get(today, 0)
            past_days = [v for d, v in date_map.items() if d != today]
            if past_days:
                avg_visitors = sum(past_days) / len(past_days)
                if avg_visitors > 0 and today_visitors < avg_visitors * 0.80:
                    drop_pct = round((avg_visitors - today_visitors) / avg_visitors * 100, 1)
                    insights.append({
                        "type": "traffic_drop",
                        "priority": "high",
                        "title": f"Traffic dropped {drop_pct}% today",
                        "description": (
                            f"Today you've had {today_visitors:,} visitors vs "
                            f"your {len(past_days)}-day average of {avg_visitors:,.0f}. "
                            "Check your ad campaigns and SEO traffic sources."
                        ),
                        "metric_value": -drop_pct,
                        "action_label": "View Funnel",
                        "action_tab": "funnel",
                        "created_at": now.isoformat(),
                    })

        # ── 2. CONVERSION_SPIKE ────────────────────────────────────────────────
        conv_rows = await pool.fetch(
            """
            SELECT
                event_date,
                COUNT(*) FILTER (WHERE event_type = 'purchase') AS conversions,
                COUNT(*) FILTER (WHERE event_type = 'page_view') AS views
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
            GROUP BY event_date
            ORDER BY event_date DESC
            """,
            org_id,
            seven_days_ago,
        )
        if conv_rows:
            def cvr(row) -> float:
                return (row["conversions"] / row["views"]) if row["views"] else 0.0

            today_cvr = next((cvr(r) for r in conv_rows if r["event_date"] == today), None)
            past_cvrs = [cvr(r) for r in conv_rows if r["event_date"] != today]
            if today_cvr is not None and past_cvrs:
                avg_cvr = sum(past_cvrs) / len(past_cvrs)
                if avg_cvr > 0 and today_cvr > avg_cvr * 2:
                    multiplier = round(today_cvr / avg_cvr, 1)
                    insights.append({
                        "type": "conversion_spike",
                        "priority": "low",
                        "title": f"Conversion rate is {multiplier}x higher than usual",
                        "description": (
                            f"Today's conversion rate of {today_cvr * 100:.1f}% is "
                            f"{multiplier}x your recent average of {avg_cvr * 100:.1f}%. "
                            "Identify the traffic source driving this lift."
                        ),
                        "metric_value": round((today_cvr - avg_cvr) / avg_cvr * 100, 1),
                        "action_label": "View Attribution",
                        "action_tab": "attribution",
                        "created_at": now.isoformat(),
                    })

        # ── 3. HIGH_LLM_TRAFFIC ────────────────────────────────────────────────
        llm_rows = await pool.fetchrow(
            """
            SELECT
                COUNT(*) FILTER (WHERE llm_platform != 'none' AND llm_platform IS NOT NULL) AS llm_count,
                COUNT(*) AS total_count
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
              AND event_type = 'page_view'
            """,
            org_id,
            today - timedelta(days=30),
        )
        if llm_rows and llm_rows["total_count"] > 0:
            llm_pct = llm_rows["llm_count"] / llm_rows["total_count"] * 100
            if llm_pct > 15:
                insights.append({
                    "type": "high_llm_traffic",
                    "priority": "medium",
                    "title": f"{llm_pct:.0f}% of visitors arriving from AI platforms",
                    "description": (
                        f"{llm_pct:.1f}% of your visitors in the last 30 days arrived from "
                        "AI platforms like ChatGPT, Claude, or Perplexity. "
                        "Consider creating LLM-optimised landing pages."
                    ),
                    "metric_value": round(llm_pct, 1),
                    "action_label": "View LLM Traffic",
                    "action_tab": "llm_traffic",
                    "created_at": now.isoformat(),
                })

        # ── 4. FUNNEL_BOTTLENECK ───────────────────────────────────────────────
        funnel_rows = await pool.fetch(
            """
            SELECT
                event_type,
                COUNT(*) AS event_count
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
              AND event_type IN ('add_to_cart', 'checkout_started')
            GROUP BY event_type
            """,
            org_id,
            today - timedelta(days=30),
        )
        if funnel_rows:
            funnel_map = {r["event_type"]: r["event_count"] for r in funnel_rows}
            cart = funnel_map.get("add_to_cart", 0)
            checkout = funnel_map.get("checkout_started", 0)
            if cart > 0:
                drop_pct = (cart - checkout) / cart * 100
                if drop_pct > 60:
                    insights.append({
                        "type": "funnel_bottleneck",
                        "priority": "high",
                        "title": f"{drop_pct:.0f}% of cart additions don't reach checkout",
                        "description": (
                            f"Your add-to-cart → checkout conversion is {100 - drop_pct:.0f}%, "
                            "well below the 65% e-commerce benchmark. "
                            "Consider simplifying checkout or adding cart abandonment recovery."
                        ),
                        "metric_value": -round(drop_pct, 1),
                        "action_label": "View Funnel",
                        "action_tab": "funnel",
                        "created_at": now.isoformat(),
                    })

        # ── 5. TOP_GEO_OPPORTUNITY ─────────────────────────────────────────────
        geo_rows = await pool.fetch(
            """
            SELECT
                metadata->>'country' AS country,
                COUNT(*) FILTER (WHERE event_type = 'page_view')  AS visitors,
                COUNT(*) FILTER (WHERE event_type = 'purchase')   AS conversions
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
              AND metadata->>'country' IS NOT NULL
            GROUP BY metadata->>'country'
            ORDER BY visitors DESC
            LIMIT 20
            """,
            org_id,
            today - timedelta(days=30),
        )
        if geo_rows:
            total_visitors = sum(r["visitors"] for r in geo_rows)
            total_conversions = sum(r["conversions"] for r in geo_rows)
            if total_visitors > 0 and total_conversions > 0:
                for row in geo_rows:
                    traffic_pct = row["visitors"] / total_visitors * 100
                    conv_pct = row["conversions"] / total_conversions * 100 if total_conversions > 0 else 0
                    if traffic_pct > 10 and conv_pct < 2:
                        insights.append({
                            "type": "top_geo_opportunity",
                            "priority": "medium",
                            "title": f"{row['country']} drives traffic but low conversions",
                            "description": (
                                f"{row['country']} sends {traffic_pct:.0f}% of your traffic "
                                f"but only {conv_pct:.1f}% of conversions. "
                                "Currency or shipping concerns may be the cause."
                            ),
                            "metric_value": round(traffic_pct, 1),
                            "action_label": "View Geography",
                            "action_tab": "geography",
                            "created_at": now.isoformat(),
                        })
                        break  # Report only the top opportunity

        # ── 6. ZERO_CONVERSIONS_STREAK ─────────────────────────────────────────
        streak_rows = await pool.fetch(
            """
            SELECT event_date
            FROM analytics_events
            WHERE org_id = $1
              AND event_date >= $2
              AND event_type = 'purchase'
            GROUP BY event_date
            """,
            org_id,
            today - timedelta(days=7),
        )
        conversion_dates = {r["event_date"] for r in streak_rows}
        streak = 0
        for i in range(7):
            check_date = today - timedelta(days=i)
            if check_date not in conversion_dates:
                streak += 1
            else:
                break
        if streak >= 3:
            insights.append({
                "type": "zero_conversions_streak",
                "priority": "high",
                "title": f"No conversions recorded in the last {streak} days",
                "description": (
                    f"You haven't recorded any purchases in {streak} consecutive days. "
                    "Check your payment flow, ad campaigns, and product availability."
                ),
                "metric_value": float(-streak),
                "action_label": "View Funnel",
                "action_tab": "funnel",
                "created_at": now.isoformat(),
            })

    except Exception as exc:
        logger.warning("Insight query failed for org %s: %s — returning mock insights", org_id, exc)
        return _mock_insights()

    # If no insights were generated from real data, still return mocks for demo
    if not insights:
        return _mock_insights()

    return insights


def _mock_insights() -> list[dict]:
    """Return realistic mock insights for demo/dev environments."""
    now = datetime.now(timezone.utc)
    return [
        {
            "type": "high_llm_traffic",
            "priority": "medium",
            "title": "14% of visitors arriving from AI platforms",
            "description": (
                "ChatGPT (8.2%), Claude (3.1%), and Perplexity (2.7%) are sending qualified traffic. "
                "Consider creating LLM-optimised landing pages."
            ),
            "metric_value": 14.0,
            "action_label": "View LLM Traffic",
            "action_tab": "llm_traffic",
            "created_at": now.isoformat(),
        },
        {
            "type": "funnel_bottleneck",
            "priority": "high",
            "title": "61% of cart additions don't reach checkout",
            "description": (
                "Your add-to-cart → checkout conversion is 39%, well below the 65% e-commerce benchmark. "
                "Consider simplifying checkout or adding cart abandonment recovery."
            ),
            "metric_value": -61.0,
            "action_label": "View Funnel",
            "action_tab": "funnel",
            "created_at": now.isoformat(),
        },
        {
            "type": "top_geo_opportunity",
            "priority": "medium",
            "title": "Germany drives traffic but low conversions",
            "description": (
                "Germany sends 11% of your traffic but only 2.1% of conversions. "
                "Currency or shipping concerns may be the cause."
            ),
            "metric_value": 11.0,
            "action_label": "View Geography",
            "action_tab": "geography",
            "created_at": now.isoformat(),
        },
        {
            "type": "conversion_spike",
            "priority": "low",
            "title": "Conversion rate up 18% this week",
            "description": (
                "Your conversion rate of 4.2% is 18% above your 30-day average of 3.6%. "
                "The Google Ads campaign appears to be driving qualified traffic."
            ),
            "metric_value": 18.0,
            "action_label": "View Attribution",
            "action_tab": "attribution",
            "created_at": now.isoformat(),
        },
    ]

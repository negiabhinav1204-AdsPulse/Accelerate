import logging
from core.database import get_pool

logger = logging.getLogger(__name__)


async def record_impression(
    experiment_id: str,
    variant_id: str,
    utm_cluster: str = "default",
) -> None:
    """
    Increment impression count for a bandit arm.
    Upserts into BanditStat with ON CONFLICT — if the table doesn't exist yet,
    logs a warning and returns gracefully.
    """
    try:
        pool = await get_pool()
        await pool.execute(
            """INSERT INTO "BanditStat" ("experimentId", "variantId", "utmCluster", impressions, conversions, alpha, "betaParam")
               VALUES ($1, $2, $3, 1, 0, 1, 1)
               ON CONFLICT ("experimentId", "variantId", "utmCluster")
               DO UPDATE SET impressions = "BanditStat".impressions + 1""",
            experiment_id,
            variant_id,
            utm_cluster,
        )
    except Exception as e:
        logger.warning(
            "record_impression failed (BanditStat table may not exist yet): %s", e
        )


async def record_conversion(
    experiment_id: str,
    variant_id: str,
    utm_cluster: str = "default",
) -> None:
    """
    Increment conversion count and alpha parameter for a bandit arm.
    Logs a warning if BanditStat table doesn't exist yet.
    """
    try:
        pool = await get_pool()
        result = await pool.execute(
            """UPDATE "BanditStat"
               SET conversions = conversions + 1,
                   alpha = alpha + 1
               WHERE "experimentId" = $1
                 AND "variantId" = $2
                 AND "utmCluster" = $3""",
            experiment_id,
            variant_id,
            utm_cluster,
        )
        if result == "UPDATE 0":
            logger.warning(
                "record_conversion: no BanditStat row found for experiment=%s variant=%s cluster=%s",
                experiment_id,
                variant_id,
                utm_cluster,
            )
    except Exception as e:
        logger.warning(
            "record_conversion failed (BanditStat table may not exist yet): %s", e
        )


async def get_bandit_stats(experiment_id: str) -> list[dict]:
    """
    Retrieve all bandit stats rows for an experiment.
    Returns empty list if BanditStat table doesn't exist yet.
    """
    try:
        pool = await get_pool()
        rows = await pool.fetch(
            'SELECT * FROM "BanditStat" WHERE "experimentId" = $1',
            experiment_id,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        logger.warning(
            "get_bandit_stats failed (BanditStat table may not exist yet): %s", e
        )
        return []

-- BigQuery Unified Views for Accelerate Analytics
-- Replace `your_project.your_dataset` with actual BigQuery project and dataset.
-- Run once per environment (dev/prod) after ad platform sync is set up.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. unified_campaign_performance
--    Cross-platform daily campaign metrics
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `your_project.your_dataset.unified_campaign_performance` AS

-- Google Ads campaigns
SELECT
  c.id                        AS campaign_id,
  c.name                      AS campaign_name,
  'google'                    AS platform,
  c.organization_id,
  r.date,
  r.spend,
  r.impressions,
  r.clicks,
  r.conversions,
  SAFE_DIVIDE(r.clicks, r.impressions)    AS ctr,
  SAFE_DIVIDE(r.spend, r.clicks)          AS cpc,
  SAFE_DIVIDE(r.spend, r.impressions * 1000) AS cpm,
  SAFE_DIVIDE(r.revenue, r.spend)         AS roas,
  c.status
FROM `your_project.your_dataset.google_campaigns`         c
JOIN `your_project.your_dataset.google_campaign_reports`  r ON r.campaign_id = c.id

UNION ALL

-- Meta Ads campaigns
SELECT
  c.id                        AS campaign_id,
  c.name                      AS campaign_name,
  'meta'                      AS platform,
  c.organization_id,
  r.date_start                AS date,
  r.spend,
  r.impressions,
  r.clicks,
  r.actions_purchase          AS conversions,
  SAFE_DIVIDE(r.clicks, r.impressions)    AS ctr,
  SAFE_DIVIDE(r.spend, r.clicks)          AS cpc,
  SAFE_DIVIDE(r.spend, r.impressions * 1000) AS cpm,
  SAFE_DIVIDE(r.purchase_roas, 1)         AS roas,
  c.status
FROM `your_project.your_dataset.meta_campaigns`         c
JOIN `your_project.your_dataset.meta_campaign_reports`  r ON r.campaign_id = c.id

UNION ALL

-- Bing Ads campaigns
SELECT
  c.id                        AS campaign_id,
  c.name                      AS campaign_name,
  'bing'                      AS platform,
  c.organization_id,
  r.date,
  r.spend,
  r.impressions,
  r.clicks,
  r.conversions,
  SAFE_DIVIDE(r.clicks, r.impressions)    AS ctr,
  SAFE_DIVIDE(r.spend, r.clicks)          AS cpc,
  SAFE_DIVIDE(r.spend, r.impressions * 1000) AS cpm,
  SAFE_DIVIDE(r.revenue, r.spend)         AS roas,
  c.status
FROM `your_project.your_dataset.bing_campaigns`         c
JOIN `your_project.your_dataset.bing_campaign_reports`  r ON r.campaign_id = c.id;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. unified_adgroup_performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `your_project.your_dataset.unified_adgroup_performance` AS

SELECT
  ag.id          AS adgroup_id,
  ag.name        AS adgroup_name,
  ag.campaign_id,
  'google'       AS platform,
  ag.organization_id,
  r.date,
  r.spend,
  r.impressions,
  r.clicks,
  r.conversions
FROM `your_project.your_dataset.google_adgroups`         ag
JOIN `your_project.your_dataset.google_adgroup_reports`  r ON r.adgroup_id = ag.id

UNION ALL

SELECT
  ag.id          AS adgroup_id,
  ag.name        AS adgroup_name,
  ag.campaign_id,
  'meta'         AS platform,
  ag.organization_id,
  r.date_start   AS date,
  r.spend,
  r.impressions,
  r.clicks,
  r.actions_purchase AS conversions
FROM `your_project.your_dataset.meta_adsets`         ag
JOIN `your_project.your_dataset.meta_adset_reports`  r ON r.adset_id = ag.id;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. unified_ad_performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `your_project.your_dataset.unified_ad_performance` AS

SELECT
  a.id            AS ad_id,
  a.headline,
  a.campaign_id,
  a.adgroup_id,
  'google'        AS platform,
  a.organization_id,
  r.date,
  r.spend,
  r.clicks,
  r.conversions,
  'search'        AS creative_type
FROM `your_project.your_dataset.google_ads`         a
JOIN `your_project.your_dataset.google_ad_reports`  r ON r.ad_id = a.id

UNION ALL

SELECT
  a.id            AS ad_id,
  a.name          AS headline,
  a.campaign_id,
  a.adset_id      AS adgroup_id,
  'meta'          AS platform,
  a.organization_id,
  r.date_start    AS date,
  r.spend,
  r.clicks,
  r.actions_purchase AS conversions,
  a.creative_type
FROM `your_project.your_dataset.meta_ads`         a
JOIN `your_project.your_dataset.meta_ad_reports`  r ON r.ad_id = a.id;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. unified_geo_performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `your_project.your_dataset.unified_geo_performance` AS

SELECT
  r.campaign_id,
  g.country_code  AS country,
  g.region,
  g.city,
  'google'        AS platform,
  r.organization_id,
  r.date,
  r.spend,
  r.clicks,
  r.conversions
FROM `your_project.your_dataset.google_geo_reports` r
JOIN `your_project.your_dataset.google_geo_targets` g ON g.id = r.geo_target_id

UNION ALL

SELECT
  r.campaign_id,
  r.country_code  AS country,
  r.region,
  r.city,
  'meta'          AS platform,
  r.organization_id,
  r.date_start    AS date,
  r.spend,
  r.clicks,
  r.actions_purchase AS conversions
FROM `your_project.your_dataset.meta_geo_reports` r;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. unified_age_gender
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `your_project.your_dataset.unified_age_gender` AS

SELECT
  r.campaign_id,
  r.age_range,
  r.gender,
  'google'        AS platform,
  r.organization_id,
  r.date,
  r.impressions,
  r.clicks,
  r.conversions
FROM `your_project.your_dataset.google_age_gender_reports` r

UNION ALL

SELECT
  r.campaign_id,
  r.age            AS age_range,
  r.gender,
  'meta'           AS platform,
  r.organization_id,
  r.date_start     AS date,
  r.impressions,
  r.clicks,
  r.actions_purchase AS conversions
FROM `your_project.your_dataset.meta_age_gender_reports` r;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. unified_device_performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `your_project.your_dataset.unified_device_performance` AS

SELECT
  r.campaign_id,
  r.device,
  'google'        AS platform,
  r.organization_id,
  r.date,
  r.spend,
  r.clicks,
  r.conversions
FROM `your_project.your_dataset.google_device_reports` r

UNION ALL

SELECT
  r.campaign_id,
  r.device_platform AS device,
  'meta'             AS platform,
  r.organization_id,
  r.date_start       AS date,
  r.spend,
  r.clicks,
  r.actions_purchase AS conversions
FROM `your_project.your_dataset.meta_device_reports` r;

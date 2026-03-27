# Accelerate Platform Expansion — Full Implementation Reference
**Version:** 1.0 | **Created:** 2026-03-27
**Usage:** Load this file at the start of every development session when building expansion features. This is the canonical reference for all new capabilities being added to the Accelerate platform.

---

## 0. Critical Rules (Read Before Writing Any Code)

1. **No Shopify coupling** — Never reference Shopify-specific tables, APIs, or assumptions. All e-commerce data goes through `CommerceConnector` adapters. Shopify is just one adapter among many.
2. **Follow Accelerate patterns** — Refer to `feature-assist.md` for stack, naming conventions, schema style, and service ownership. This document extends it, does not replace it.
3. **Rewrite, don't copy** — The Adaptiv platform (`/Users/abhinav.negi/Downloads/adaptiv-main/`) is a reference for **logic and behavior only**. All code must be rewritten to match Accelerate's TypeScript/Python patterns, Prisma schema style, LangGraph agent structure, and LiteLLM abstraction.
4. **LLM-agnostic** — All LLM calls must go through LiteLLM. Never hardcode `anthropic` or `claude-opus` directly. Use model aliases from config.
5. **Service ownership** — Every feature belongs to exactly one service. The gateway (BFF) never contains business logic.
6. **Schema-first** — Always add Prisma models to `packages/database/prisma/schema.prisma` before writing service code.
7. **Kafka for async** — Any operation that takes >500ms or involves external APIs (sync, feed push, optimization) must be async via Kafka, not inline on the request thread.
8. **Redis for shared state** — Never use in-process dicts or module-level variables for state shared across instances. Use Redis.
9. **Test before confirming done** — Every service endpoint needs at minimum a smoke test.

---

## 1. Reference Platform

**Adaptiv** (`/Users/abhinav.negi/Downloads/adaptiv-main/`) is a working production platform whose logic serves as the reference implementation for all new Accelerate features. It is a Python FastAPI monolith — we are porting its **behavior** into Accelerate's microservices architecture.

### Adaptiv Key Files Reference Map

| Adaptiv File | What to Extract | Used In Phase |
|---|---|---|
| `api/app/routers/copilot.py` | All 48 tool definitions (lines 1065–2233), system prompt intelligence, tool routing logic | Phase 2 |
| `api/app/services/media_planner_agents.py` | 6-agent pipeline: SCOUT, PULSE, HISTORIAN, ALLOCATOR, ORACLE, STRATEGIST — full agent prompts and tool calls | Phase 3 |
| `api/app/services/ai_cmo.py` | CMO brief, health score, forecast, plan logic | Phase 3 |
| `api/app/routers/ai_cmo.py` | CMO endpoint structure | Phase 3 |
| `api/app/services/campaign_health.py` | Health scoring algorithm (WINNER/LEARNER/UNDERPERFORMER/BLEEDER thresholds) | Phase 2+8 |
| `api/app/services/campaign_intelligence.py` | Deep campaign analysis and scoring patterns | Phase 2+8 |
| `api/app/services/optimization_agent.py` | Optimization reasoning logic | Phase 8 |
| `api/app/services/agent_orchestrator.py` | Multi-agent coordination patterns | Phase 8 |
| `api/app/routers/experiments.py` | Experiment CRUD endpoints and data shapes | Phase 4 |
| `api/app/routers/edge.py` | Edge resolver request/response pattern | Phase 4 |
| `api/app/routers/zones.py` | Zone management structure | Phase 4 |
| `api/app/routers/variants.py` | Variant management and assignment | Phase 4 |
| `api/app/services/experiment_engine.py` | Traffic bucketing and allocation logic | Phase 4 |
| `api/app/services/experiment_analytics.py` | Statistical significance (z-test implementation) | Phase 4 |
| `api/app/services/bandit.py` | Thompson Sampling multi-armed bandit | Phase 4 |
| `api/app/services/variant_engine.py` | Variant generation logic | Phase 4 |
| `api/app/services/experiment_factory.py` | One-shot experiment creation | Phase 4 |
| `api/app/services/experiment_performance.py` | Winner detection algorithm | Phase 4 |
| `api/app/routers/product_feeds.py` | Feed management endpoints | Phase 5 |
| `api/app/routers/merchant_center.py` | GMC connection and diagnostics | Phase 5 |
| `api/app/services/reporting_ingestion.py` | Metric normalization from ad platforms | Phase 7 |
| `api/app/routers/analytics.py` | Analytics endpoint structure | Phase 7 |
| `api/app/routers/ecommerce.py` | E-commerce KPI patterns (AOV, LTV, repeat rate) | Phase 7 |
| `api/app/services/analytics.py` | Funnel analysis logic | Phase 7 |
| `api/app/routers/reporting.py` | Reporting aggregation patterns | Phase 7 |
| `api/app/services/llm_detector.py` | LLM bot detection logic and user-agent patterns | Phase 7 |
| `api/app/routers/llm.py` | LLM traffic endpoint structure | Phase 7 |
| `api/app/routers/keyword_planner.py` | Keyword planner endpoints | Phase 8 |
| `api/app/services/keyword_research.py` | Keyword research via Google Ads API | Phase 8 |
| `api/app/services/keyword_clustering.py` | AI keyword clustering (intent grouping) | Phase 8 |
| `api/app/services/keyword_engine.py` | Keyword scoring and ranking | Phase 8 |
| `api/app/routers/journeys.py` | Journey builder endpoints | Phase 8 |
| `api/app/services/journey_engine.py` | Journey step execution logic | Phase 8 |
| `api/app/routers/leads.py` | Lead form CRUD + capture endpoint | Phase 6 |
| `api/app/routers/cdp.py` | CDP endpoint structure | Phase 1 |
| `api/app/services/segment_engine.py` | Audience segmentation rules engine | Phase 1 |
| `api/app/services/visitor.py` | Visitor profile structure | Phase 1 |
| `api/app/services/visitor_enrichment.py` | Profile enrichment patterns | Phase 1 |
| `api/app/routers/shopify.py` | Shopify adapter implementation (reference for adapter pattern only) | Phase 1 |
| `api/app/services/shopify_sync.py` | Sync pipeline logic (reference for sync pattern only) | Phase 1 |
| `api/app/services/shopify_enrichment.py` | Data enrichment patterns | Phase 1 |
| `api/app/services/insights.py` | Insight generation logic | Phase 2 |
| `api/app/services/smart_resolver.py` | Ambiguous input resolution patterns | Phase 2 |
| `api/app/services/ad_creator.py` | Product suggestion ranking algorithm | Phase 2 |
| `api/app/routers/insights.py` | Insight endpoint structure | Phase 2 |
| `api/app/services/google_ad_uploader.py` | Google Ads campaign creation (Search RSA, Display, PMax) | Phase 2 (campaign creation tools) |
| `api/app/services/meta_ads.py` | Meta campaign creation patterns | Phase 2 |
| `api/app/services/bing_ad_uploader.py` | Bing campaign creation patterns | Phase 2 |

---

## 2. Architecture Overview

```
Frontend Dashboard (Next.js 15, apps/dashboard)
    └── accelerate-gateway (Node.js + Fastify — BFF)
            ├── accelerate-auth-service         [EXISTING — no changes]
            ├── accelerate-campaign-service     [EXTEND — Java 21 Spring Boot]
            ├── accelerate-reporting-service    [EXTEND — Python 3.12 FastAPI]
            ├── accelerate-agent-service        [EXTEND — Python 3.12 FastAPI + LangGraph]
            ├── accelerate-creative-service     [EXISTING — Python 3.12 FastAPI]
            ├── accelerate-commerce-service     [NEW — Python 3.12 FastAPI]
            ├── accelerate-cdp-service          [NEW — Python 3.12 FastAPI]
            └── accelerate-personalization-service [NEW — Python 3.12 FastAPI]

accelerate-pixel-service (Node.js + Fastify — high-throughput, separate path)
    └── Kafka → accelerate-ingestion-service (Java 17 + Spark)
                    └── BigQuery (analytics warehouse)
                            └── accelerate-reporting-service reads from here

accelerate-commerce-service
    └── Kafka: commerce.product.synced, commerce.order.created, commerce.revenue.updated
                    └── accelerate-ingestion-service writes to BigQuery commerce tables
    └── accelerate-cdp-service reads product + order data for identity resolution
```

### New Services Directory Structure

```
/Users/abhinav.negi/Documents/Accelerate/services/
    commerce/           # accelerate-commerce-service
        adapters/
            shopify.py
            woocommerce.py
            wix.py
            bigcommerce.py
            csv.py
            manual.py
        routers/
            connectors.py
            products.py
            orders.py
            revenue.py
            feeds.py
            merchant_center.py
        services/
            sync_engine.py
            feed_optimizer.py
            gmc_client.py
            feed_health.py
            zombie_sku.py
        main.py

    cdp/                # accelerate-cdp-service
        routers/
            profiles.py
            segments.py
            audiences.py
            ingestion.py
        services/
            identity_resolver.py
            segment_engine.py
            audience_sync.py
        main.py

    personalization/    # accelerate-personalization-service
        routers/
            pages.py
            zones.py
            variants.py
            experiments.py
            edge.py
        services/
            experiment_engine.py
            bandit.py
            stats.py
            edge_resolver.py
        main.py
```

---

## 3. New Prisma Schema — Full Additions

Add all of the following to `packages/database/prisma/schema.prisma`. Never delete existing models — only add new ones and migrate data.

### 3.1 New Enums

```prisma
enum CommercePlatform {
  SHOPIFY      @map("shopify")
  WOOCOMMERCE  @map("woocommerce")
  WIX          @map("wix")
  BIGCOMMERCE  @map("bigcommerce")
  MAGENTO      @map("magento")
  CUSTOM       @map("custom")
  MANUAL       @map("manual")
  CSV          @map("csv")
}

enum SyncStatus {
  PENDING    @map("pending")
  SYNCING    @map("syncing")
  SYNCED     @map("synced")
  FAILED     @map("failed")
}

enum ProductStatus {
  ACTIVE   @map("active")
  INACTIVE @map("inactive")
  ARCHIVED @map("archived")
}

enum IdentitySource {
  SHOPIFY     @map("shopify")
  WOOCOMMERCE @map("woocommerce")
  WIX         @map("wix")
  PIXEL       @map("pixel")
  CRM         @map("crm")
  UPLOAD      @map("upload")
  META        @map("meta")
  GOOGLE      @map("google")
  BING        @map("bing")
}

enum ExperimentStatus {
  DRAFT    @map("draft")
  RUNNING  @map("running")
  PAUSED   @map("paused")
  ENDED    @map("ended")
}

enum AllocationMode {
  RANDOM @map("random")
  BANDIT @map("bandit")
}

enum FeedChannel {
  GOOGLE_MC   @map("google_mc")
  META_CATALOG @map("meta_catalog")
  BING_MC     @map("bing_mc")
  TIKTOK      @map("tiktok")
  PINTEREST   @map("pinterest")
}

enum FormHosting {
  OWN_DOMAIN @map("own_domain")
  SHOPIFY    @map("shopify")
  TYPEFORM   @map("typeform")
  HUBSPOT    @map("hubspot")
}

enum JourneyStatus {
  DRAFT   @map("draft")
  ACTIVE  @map("active")
  PAUSED  @map("paused")
  ENDED   @map("ended")
}

enum CampaignCategory {
  WINNER        @map("winner")
  LEARNER       @map("learner")
  UNDERPERFORMER @map("underperformer")
  BLEEDER       @map("bleeder")
}
```

### 3.2 Commerce Layer

```prisma
model CommerceConnector {
  id              String            @id @default(uuid()) @db.Uuid
  organizationId  String            @db.Uuid
  platform        CommercePlatform
  name            String
  credentials     Json              // AES-256 encrypted: store_url, access_token, api_key, etc.
  syncStatus      SyncStatus        @default(PENDING)
  lastSyncAt      DateTime?
  isActive        Boolean           @default(true)
  metadata        Json              @default("{}")
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  organization    Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  products        Product[]
  orders          CommerceOrder[]
  feeds           ProductFeed[]
  dailyRevenue    DailyRevenueSummary[]

  @@index([organizationId])
}

model Product {
  id               String            @id @default(uuid()) @db.Uuid
  connectorId      String            @db.Uuid
  organizationId   String            @db.Uuid
  externalId       String            // platform-native ID
  title            String
  description      String?           @db.Text
  price            Decimal           @db.Decimal(10, 2)
  salePrice        Decimal?          @db.Decimal(10, 2)
  currency         String            @default("USD")
  imageUrl         String?
  additionalImages String[]
  handle           String?
  brand            String?
  googleCategory   String?
  sku              String?
  barcode          String?
  status           ProductStatus     @default(ACTIVE)
  inventoryQty     Int?
  tags             String[]
  customLabels     Json              @default("{}")
  salesVelocity    Float?            // units sold per day (computed)
  revenueL30d      Decimal?          @db.Decimal(12, 2)
  metadata         Json              @default("{}")
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  connector        CommerceConnector @relation(fields: [connectorId], references: [id], onDelete: Cascade)
  variants         ProductVariant[]

  @@unique([connectorId, externalId])
  @@index([organizationId])
}

model ProductVariant {
  id         String  @id @default(uuid()) @db.Uuid
  productId  String  @db.Uuid
  externalId String
  title      String
  price      Decimal @db.Decimal(10, 2)
  sku        String?
  inventory  Int?
  product    Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model CommerceOrder {
  id             String            @id @default(uuid()) @db.Uuid
  connectorId    String            @db.Uuid
  organizationId String            @db.Uuid
  externalId     String
  customerEmail  String?
  customerName   String?
  totalAmount    Decimal           @db.Decimal(10, 2)
  currency       String            @default("USD")
  channel        String?
  status         String
  placedAt       DateTime
  items          CommerceOrderItem[]
  connector      CommerceConnector @relation(fields: [connectorId], references: [id], onDelete: Cascade)

  @@unique([connectorId, externalId])
  @@index([organizationId, placedAt])
}

model CommerceOrderItem {
  id         String        @id @default(uuid()) @db.Uuid
  orderId    String        @db.Uuid
  productId  String?       @db.Uuid
  externalProductId String?
  title      String
  quantity   Int
  price      Decimal       @db.Decimal(10, 2)
  order      CommerceOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
}

model DailyRevenueSummary {
  id             String            @id @default(uuid()) @db.Uuid
  organizationId String            @db.Uuid
  connectorId    String            @db.Uuid
  date           DateTime          @db.Date
  revenue        Decimal           @db.Decimal(12, 2)
  orders         Int
  channel        String?
  currency       String            @default("USD")
  connector      CommerceConnector @relation(fields: [connectorId], references: [id], onDelete: Cascade)

  @@unique([connectorId, date, channel])
  @@index([organizationId, date])
}
```

### 3.3 CDP Layer

```prisma
model CustomerProfile {
  id             String             @id @default(uuid()) @db.Uuid
  organizationId String             @db.Uuid
  email          String?
  phone          String?
  name           String?
  totalSpend     Decimal?           @db.Decimal(12, 2)
  orderCount     Int                @default(0)
  lastOrderAt    DateTime?
  firstOrderAt   DateTime?
  ltv            Decimal?           @db.Decimal(12, 2)
  aov            Decimal?           @db.Decimal(10, 2)
  tags           String[]
  isVip          Boolean            @default(false)
  isLapsed       Boolean            @default(false)
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  organization   Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  identities     CustomerIdentity[]
  events         CustomerEvent[]
  segments       CustomerSegmentMembership[]

  @@index([organizationId])
}

model CustomerIdentity {
  id         String          @id @default(uuid()) @db.Uuid
  profileId  String          @db.Uuid
  source     IdentitySource
  externalId String
  metadata   Json            @default("{}")
  createdAt  DateTime        @default(now())
  profile    CustomerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([source, externalId])
}

model CustomerEvent {
  id          String          @id @default(uuid()) @db.Uuid
  profileId   String          @db.Uuid
  orgId       String          @db.Uuid
  eventType   String          // page_view | add_to_cart | purchase | form_submit | custom
  properties  Json            @default("{}")
  occurredAt  DateTime        @default(now())
  profile     CustomerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([orgId, occurredAt])
}

model AudienceSegment {
  id              String                      @id @default(uuid()) @db.Uuid
  organizationId  String                      @db.Uuid
  name            String
  description     String?
  rules           Json                        // [{field, operator, value, logic}]
  estimatedSize   Int?
  syncedPlatforms String[]
  lastSyncAt      DateTime?
  createdAt       DateTime                    @default(now())
  updatedAt       DateTime                    @updatedAt
  members         CustomerSegmentMembership[]
  organization    Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
}

model CustomerSegmentMembership {
  profileId  String          @db.Uuid
  segmentId  String          @db.Uuid
  addedAt    DateTime        @default(now())
  profile    CustomerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  segment    AudienceSegment @relation(fields: [segmentId], references: [id], onDelete: Cascade)

  @@id([profileId, segmentId])
}
```

### 3.4 Personalization + A/B Testing

```prisma
model SitePage {
  id             String                @id @default(uuid()) @db.Uuid
  organizationId String                @db.Uuid
  name           String
  url            String
  isActive       Boolean               @default(true)
  createdAt      DateTime              @default(now())
  organization   Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  zones          PersonalizationZone[]

  @@index([organizationId])
}

model PersonalizationZone {
  id          String       @id @default(uuid()) @db.Uuid
  pageId      String       @db.Uuid
  name        String
  selector    String       // CSS selector — e.g. "#hero-banner"
  defaultHtml String       @db.Text
  createdAt   DateTime     @default(now())
  page        SitePage     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  variants    PageVariant[]
  experiments Experiment[]
}

model PageVariant {
  id          String              @id @default(uuid()) @db.Uuid
  zoneId      String              @db.Uuid
  name        String
  html        String              @db.Text
  isControl   Boolean             @default(false)
  createdAt   DateTime            @default(now())
  zone        PersonalizationZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  allocations ExperimentVariantAllocation[]
  results     ExperimentResult[]
}

model Experiment {
  id             String               @id @default(uuid()) @db.Uuid
  organizationId String               @db.Uuid
  zoneId         String               @db.Uuid
  name           String
  status         ExperimentStatus     @default(DRAFT)
  trafficSplit   Int                  @default(50)
  holdoutPct     Int                  @default(0)
  allocationMode AllocationMode       @default(RANDOM)
  startedAt      DateTime?
  endedAt        DateTime?
  winnerVariantId String?             @db.Uuid
  createdAt      DateTime             @default(now())
  zone           PersonalizationZone  @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  allocations    ExperimentVariantAllocation[]
  results        ExperimentResult[]

  @@index([organizationId])
}

model ExperimentVariantAllocation {
  experimentId String      @db.Uuid
  variantId    String      @db.Uuid
  weight       Int         @default(50) // traffic weight %
  experiment   Experiment  @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  variant      PageVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@id([experimentId, variantId])
}

model ExperimentResult {
  id           String      @id @default(uuid()) @db.Uuid
  experimentId String      @db.Uuid
  variantId    String      @db.Uuid
  date         DateTime    @db.Date
  impressions  Int         @default(0)
  conversions  Int         @default(0)
  revenue      Decimal     @db.Decimal(12, 2) @default(0)
  experiment   Experiment  @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  variant      PageVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([experimentId, variantId, date])
}
```

### 3.5 Product Feeds + GMC

```prisma
model ProductFeed {
  id             String            @id @default(uuid()) @db.Uuid
  organizationId String            @db.Uuid
  connectorId    String            @db.Uuid
  channel        FeedChannel
  name           String
  settings       Json              @default("{}")
  healthScore    Int?
  lastPushedAt   DateTime?
  createdAt      DateTime          @default(now())
  connector      CommerceConnector @relation(fields: [connectorId], references: [id], onDelete: Cascade)
  rules          FeedRule[]

  @@index([organizationId])
}

model FeedRule {
  id         String      @id @default(uuid()) @db.Uuid
  feedId     String      @db.Uuid
  name       String
  priority   Int         @default(0)
  conditions Json        // [{field, operator, value}]
  actions    Json        // [{type, field, value}]
  isActive   Boolean     @default(true)
  feed       ProductFeed @relation(fields: [feedId], references: [id], onDelete: Cascade)
}

model MerchantCenterAccount {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  merchantId     String
  accountName    String
  credentials    Json     // AES-256 encrypted
  isActive       Boolean  @default(true)
  lastSyncAt     DateTime?
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, merchantId])
}
```

### 3.6 Lead Forms

```prisma
model LeadForm {
  id             String          @id @default(uuid()) @db.Uuid
  organizationId String          @db.Uuid
  title          String
  description    String?
  incentive      String?
  fields         Json            // [{name, type, label, required, options?}]
  hostingType    FormHosting
  publishedUrl   String?
  externalFormId String?
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  submissions    LeadSubmission[]
}

model LeadSubmission {
  id          String   @id @default(uuid()) @db.Uuid
  formId      String   @db.Uuid
  data        Json
  sourceUrl   String?
  ipAddress   String?
  submittedAt DateTime @default(now())
  form        LeadForm @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@index([formId, submittedAt])
}
```

### 3.7 Campaign Intelligence

```prisma
model CampaignHealthScore {
  id              String          @id @default(uuid()) @db.Uuid
  organizationId  String          @db.Uuid
  campaignId      String          @db.Uuid
  platform        String
  date            DateTime        @db.Date
  score           Int
  category        CampaignCategory
  roas            Decimal?        @db.Decimal(8, 2)
  cpa             Decimal?        @db.Decimal(8, 2)
  spend           Decimal         @db.Decimal(10, 2)
  impressions     Int             @default(0)
  clicks          Int             @default(0)
  conversions     Int             @default(0)
  recommendations Json            @default("[]")
  createdAt       DateTime        @default(now())
  campaign        Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, date])
  @@index([organizationId, date])
}

model OptimizationRecommendation {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  agentType      String   // budget | bid | creative | audience | anomaly | pacing | cmo
  priority       String   // high | medium | low
  title          String
  description    String   @db.Text
  impact         String   // estimated impact description
  actionType     String   // increase_budget | pause_campaign | refresh_creative | etc.
  actionPayload  Json     @default("{}")
  status         String   @default("pending") // pending | applied | dismissed
  appliedAt      DateTime?
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, status, createdAt])
}
```

### 3.8 Journeys + Keyword Research

```prisma
model Journey {
  id             String        @id @default(uuid()) @db.Uuid
  organizationId String        @db.Uuid
  name           String
  status         JourneyStatus @default(DRAFT)
  triggerType    String        // first_purchase | form_submit | cart_abandon | custom
  triggerConfig  Json          @default("{}")
  createdAt      DateTime      @default(now())
  steps          JourneyStep[]
  organization   Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
}

model JourneyStep {
  id        String  @id @default(uuid()) @db.Uuid
  journeyId String  @db.Uuid
  order     Int
  type      String  // email | ad | delay | condition | sms
  name      String
  config    Json
  journey   Journey @relation(fields: [journeyId], references: [id], onDelete: Cascade)
}

model KeywordResearch {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  seedKeywords   String[]
  results        Json     // [{keyword, searchVolume, competition, bidLow, bidHigh, intent}]
  clusters       Json     @default("[]")
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
}
```

---

## 4. Phase-by-Phase Implementation Guide

---

### PHASE 1 — Multi-Platform Commerce Abstraction + CDP Foundation
**Service:** `accelerate-commerce-service` (new) + `accelerate-cdp-service` (new)
**Priority:** HIGHEST — all other phases depend on this
**Adaptiv Reference:** `api/app/routers/shopify.py`, `api/app/services/shopify_sync.py`, `api/app/services/shopify_enrichment.py`, `api/app/routers/cdp.py`, `api/app/services/segment_engine.py`, `api/app/services/visitor.py`

#### 1.1 Commerce Connector Adapter Pattern

Build a base `CommerceAdapter` abstract class with the following interface:

```python
# services/commerce/adapters/base.py
class CommerceAdapter(ABC):
    async def test_connection(self) -> bool
    async def fetch_products(self, since: datetime | None) -> list[dict]
    async def fetch_orders(self, since: datetime, until: datetime) -> list[dict]
    async def fetch_inventory(self, product_ids: list[str]) -> list[dict]
    async def normalize_product(self, raw: dict) -> dict  # → Product schema
    async def normalize_order(self, raw: dict) -> dict    # → CommerceOrder schema
```

Implement adapters for:
- `ShopifyAdapter` — reference `api/app/routers/shopify.py` for REST API calls, Shopify admin API version 2024-01
- `WooCommerceAdapter` — WooCommerce REST API v3
- `WixAdapter` — Wix Stores API
- `BigCommerceAdapter` — BigCommerce v2/v3 API
- `CsvAdapter` — parse CSV with column mapping config
- `ManualAdapter` — direct create/update via dashboard

**Key rule:** Adapters return normalized Python dicts matching the `Product` and `CommerceOrder` Prisma schema. No adapter-specific fields leak into the rest of the system.

#### 1.2 Sync Pipeline

```
POST /connectors/:id/sync  →  Kafka event: commerce.sync.requested
Kafka consumer (ingestion-service) → calls commerce-service adapter → writes to Postgres + BigQuery
```

Reference `api/app/services/shopify_sync.py` for the sync state tracking pattern (`sync_state.py`). Replicate it with `SyncStatus` enum in `CommerceConnector`.

Daily scheduled sync via Vercel/Cloud Scheduler cron → Kafka event.
Webhook listener per platform (Shopify webhooks, WooCommerce webhooks) for real-time updates.

#### 1.3 Commerce Endpoints (accelerate-commerce-service)

```
POST   /connectors                          # Create connector (all platforms)
GET    /connectors                          # List org connectors
GET    /connectors/:id                      # Get connector details + sync status
POST   /connectors/:id/sync                 # Trigger manual sync
DELETE /connectors/:id                      # Disconnect

GET    /products?connectorId&status&search  # List products (paginated)
GET    /products/:id                        # Product detail
GET    /products/suggestions?orgId          # AI-ranked products by sales velocity
                                            # Reference: api/app/services/ad_creator.py get_product_suggestions()

GET    /orders?connectorId&from&to          # List orders
GET    /revenue/summary?orgId&days          # KPI summary (revenue, orders, AOV)
                                            # Reference: api/app/routers/ecommerce.py for KPI structure
GET    /revenue/daily?orgId&from&to         # Daily revenue time series
GET    /revenue/by-product?orgId&days       # Top products by revenue
GET    /revenue/by-channel?orgId&days       # Revenue by channel
GET    /revenue/by-geography?orgId&days     # Geographic revenue breakdown
                                            # Reference: api/app/routers/ecommerce.py lines 580-700

GET    /inventory/health?orgId              # Low-stock, out-of-stock alerts
                                            # Reference: api/app/routers/ecommerce.py /inventory endpoint
```

#### 1.4 CDP Endpoints (accelerate-cdp-service)

```
GET    /profiles?orgId&search&segment       # List customer profiles
GET    /profiles/:id                        # Profile detail + identity graph
POST   /profiles/ingest/upload             # CSV customer list upload
POST   /profiles/ingest/events             # Pixel event ingestion (from pixel-service)

POST   /segments                            # Create segment with rules
GET    /segments?orgId                      # List segments
GET    /segments/:id                        # Segment detail
GET    /segments/:id/preview               # Estimated size + sample profiles
POST   /segments/:id/sync/:platform        # Sync to Meta/Google/Bing audiences
                                            # Reference: api/app/services/segment_engine.py
                                            # Reference: api/app/routers/cdp.py
DELETE /segments/:id
```

#### 1.5 Identity Resolution Logic

Reference `api/app/services/visitor.py` and `api/app/services/visitor_enrichment.py` for enrichment patterns.

Resolution priority (highest to lowest confidence):
1. Email exact match
2. Phone exact match
3. Platform ID match (same Shopify customer ID + org)
4. Cookie/pixel ID match

When merging: keep oldest `createdAt`, sum `orderCount`, max `totalSpend`, union `tags`.

#### 1.6 Frontend Pages (Phase 1)

- `apps/dashboard/app/organizations/[slug]/connectors/commerce/page.tsx`
  — List all commerce connectors, platform logos, sync status, last sync time, "Add Connector" button with platform picker

- `apps/dashboard/app/organizations/[slug]/products/page.tsx`
  — Product catalog table with connector filter, status filter, search, sales velocity badge, custom labels

- `apps/dashboard/app/organizations/[slug]/cdp/page.tsx`
  — Customer profiles table, segment list sidebar, identity source breakdown

- `apps/dashboard/app/organizations/[slug]/cdp/segments/page.tsx`
  — Segment list with rule builder UI (field + operator + value chains), estimated size, sync status per platform

---

### PHASE 2 — Accelera AI Expansion (5 → 48 Tools)
**Service:** `accelerate-agent-service` (extend)
**Priority:** HIGH — core product value
**Adaptiv Reference:** `api/app/routers/copilot.py` lines 1065–2233 for all tool definitions and routing logic. Study each tool's input schema and return structure.

#### 2.1 Tool Architecture (LangGraph)

Unlike Adaptiv's 9000-line monolithic `copilot.py`, implement each tool as a **separate Python module** in `agent-service`:

```
services/agent/
    tools/
        ecommerce/
            get_products.py
            get_sales.py
            get_ecommerce_overview.py
            get_inventory_health.py
            get_product_insights.py
            get_product_suggestions.py
        analytics/
            get_analytics_overview.py
            get_platform_comparison.py
            get_funnel_analysis.py
            get_daily_trends.py
            analyze_wasted_spend.py
            get_demographic_insights.py
            get_placement_insights.py
            get_revenue_breakdown.py
            get_sales_regions.py
            get_executive_summary.py
            query_reporting_data.py
        campaign/
            campaign_health_check.py
            campaign_optimizer.py
            toggle_campaign.py
            update_budget.py
            get_campaign_history.py
        audience/
            list_audiences.py
            create_custom_audience.py
            create_lookalike_audience.py
            get_audience_insights.py
            smart_targeting.py
            search_locations.py
        feeds/
            get_feed_health.py
            generate_product_feed.py
            push_feed_to_merchant_center.py
            get_merchant_center_status.py
            get_merchant_center_diagnostics.py
        leads/
            create_lead_form.py
            get_lead_submissions.py
        platform/
            get_connected_platforms.py
            get_ad_platform_status.py
            get_merchant_center_status.py
        strategy/
            suggest_campaign_strategy.py
            get_campaign_strategies.py
            growth_opportunities.py
            auto_setup_everything.py
        registry.py       # maps tool name → handler function
```

Each tool module exports a `schema` (JSON Schema for LangGraph tool) and an async `handler(tool_input, context) → dict` function.

`registry.py` imports all tools and exposes `TOOL_REGISTRY: dict[str, Tool]`.

The main chat endpoint uses LangGraph's `ToolNode` with `TOOL_REGISTRY`.

#### 2.2 Intelligence Tool Details

**`campaign_health_check`**
Reference: `api/app/services/campaign_health.py`
Logic: Query `AdPlatformReport` for last 30 days. For each campaign compute:
- ROAS (revenue / spend). Winner: >3.0. Learner: spend <$100. Underperformer: ROAS 1–3. Bleeder: ROAS <1.
- CPA vs target CPA. CTR vs platform benchmark.
Return: structured health card per campaign with category, score, recommended action.
Render as: `HealthScoreCard` rich card in chat UI.

**`analyze_wasted_spend`**
Reference: `api/app/routers/copilot.py` → `analyze_wasted_spend` tool handler
Logic: Identify campaigns/adsets where spend > $X AND conversions = 0, or ROAS < 0.5. Group by platform, campaign, time range.
Return: total wasted spend amount, breakdown table, recommended actions (pause, reduce budget).

**`get_funnel_analysis`**
Reference: `api/app/services/analytics.py`
Logic: From pixel events (BigQuery): count unique visitors → product views → add-to-cart → checkout → purchase. Compute drop-off % at each stage. Per-platform breakdown using UTM source.
Return: funnel stages with counts, drop-off rates, and biggest opportunity stage.

**`get_revenue_breakdown`**
Reference: `api/app/routers/copilot.py` → `get_revenue_breakdown` handler, `api/app/routers/ecommerce.py`
Logic: Ad-attributed revenue = sum of `AdPlatformReport.conversions_value` by platform. Total revenue = `DailyRevenueSummary` sum. Organic = Total - Ad-attributed.
Return: pie breakdown + time series of ad vs organic.

**`get_executive_summary`**
Reference: `api/app/routers/copilot.py` → `get_executive_summary` handler
Return: blended ROAS across all platforms, MER (total ad spend / total revenue), total impressions, clicks, conversions, top-performing platform, trend vs prior period.

**`smart_targeting`**
Reference: `api/app/routers/copilot.py` → `smart_targeting` handler, `api/app/routers/ecommerce.py` smart targeting section
Logic: Query `CommerceOrder` (not Shopify-specific) for geographic concentration, AOV distribution, customer segments. Return recommended geo, budget range, and audience type.

**`query_reporting_data`**
Reference: `api/app/routers/copilot.py` → `query_reporting_data` handler
Logic: LLM translates natural language → BigQuery SQL against `AdPlatformReport` and commerce tables. Execute via reporting-service. Return table + summary.
Safety: whitelist SELECT-only, block any DDL/DML.

#### 2.3 Rich Card UI Components

For each new tool, build a corresponding rich card renderer in `apps/dashboard/components/accelera-ai/cards/`:

```
cards/
    health-score-card.tsx       # Campaign health table with category badges
    executive-summary-card.tsx  # KPI tiles: blended ROAS, MER, spend, revenue
    funnel-chart-card.tsx       # Horizontal funnel with drop-off %
    revenue-breakdown-card.tsx  # Pie + time series
    wasted-spend-card.tsx       # Alert card with savings amount + action buttons
    platform-comparison-card.tsx # Side-by-side platform metrics table
    product-leaderboard-card.tsx # Top products ranked by revenue/velocity
    audience-card.tsx           # Audience size + overlap visualization
    feed-health-card.tsx        # Feed score + disapproval list
```

Pattern: each card is a React component that receives the tool's return dict as props. The Accelera AI chat renderer dispatches to the correct card based on `rich_content.type`.

---

### PHASE 3 — Media Planning Pipeline + AI CMO
**Service:** `accelerate-agent-service` (extend)
**Adaptiv Reference:** `api/app/services/media_planner_agents.py` (full file — all 6 agent prompts), `api/app/services/ai_cmo.py`, `api/app/routers/ai_cmo.py`

#### 3.1 Media Planning Pipeline (LangGraph StateGraph)

```python
# services/agent/media_planner/pipeline.py

class MediaPlanState(TypedDict):
    org_id: str
    budget: float
    currency: str
    scout_output: dict      # client profile
    pulse_output: dict      # demand analysis
    historian_output: dict  # historical performance
    allocator_output: dict  # budget allocation
    oracle_output: dict     # forecasts
    strategist_output: dict # final plan

graph = StateGraph(MediaPlanState)
graph.add_node("scout", scout_agent)
graph.add_node("pulse", pulse_agent)
graph.add_node("historian", historian_agent)
graph.add_node("allocator", allocator_agent)
graph.add_node("oracle", oracle_agent)
graph.add_node("strategist", strategist_agent)
graph.add_edge("scout", "pulse")
graph.add_edge("pulse", "historian")
graph.add_edge("historian", "allocator")
graph.add_edge("allocator", "oracle")
graph.add_edge("oracle", "strategist")
```

Each agent node is a LiteLLM call with a specialized system prompt. **Copy the agent prompts from Adaptiv's `media_planner_agents.py` and adapt them to use Accelerate's data sources** (CommerceConnector, CommerceOrder, CustomerProfile instead of Shopify-specific tables).

Shared tools available to all agents:
- `query_warehouse(sql)` → executes against BigQuery via reporting-service
- `get_client_profile(org_id)` → pulls from commerce-service + cdp-service + ad platforms

Expose via:
```
POST /media-planner/run        # triggers pipeline, returns plan_id
GET  /media-planner/:plan_id   # get plan status + result
```

Stream agent progress via SSE for real-time UI updates.

#### 3.2 AI CMO Module

Reference: `api/app/services/ai_cmo.py` — extract all 6 CMO functions and rewrite using LiteLLM + BigQuery via reporting-service.

```
GET  /cmo/brief?orgId       # Daily cross-platform snapshot
POST /cmo/ask               # NL → BigQuery SQL question
GET  /cmo/health?orgId      # Health score 0-100 with dimension breakdown
GET  /cmo/forecast?orgId&days=30  # Revenue/ROAS forecast with confidence intervals
GET  /cmo/plan?orgId        # Full strategic marketing plan
GET  /cmo/dashboard?orgId   # Blended cross-platform metrics dashboard
```

Health score dimensions (reference Adaptiv's CMO health logic):
- Spend efficiency (ROAS vs benchmark): 0–20 pts
- Audience health (segment freshness, lookalike coverage): 0–20 pts
- Creative performance (CTR vs fatigue signals): 0–20 pts
- Funnel health (conversion rate vs benchmark): 0–20 pts
- Budget pacing (on-track vs over/underspending): 0–20 pts

#### 3.3 Frontend Pages (Phase 3)

- `apps/dashboard/app/organizations/[slug]/media-planner/page.tsx`
  — Budget input, platform selection, trigger button. Agent progress stepper (SCOUT → PULSE → HISTORIAN → ALLOCATOR → ORACLE → STRATEGIST). Plan output with platform allocation breakdown, forecast table, 30/60/90-day roadmap.

- `apps/dashboard/app/organizations/[slug]/cmo/page.tsx`
  — Daily brief card, health score ring (with dimension breakdown), forecast chart, strategic recommendations list with priority badges.

---

### PHASE 4 — Web Personalization + A/B Testing
**Service:** `accelerate-personalization-service` (new)
**Adaptiv Reference:** `api/app/routers/experiments.py`, `api/app/routers/edge.py`, `api/app/routers/zones.py`, `api/app/routers/variants.py`, `api/app/routers/pages.py`, `api/app/services/experiment_engine.py`, `api/app/services/experiment_analytics.py`, `api/app/services/bandit.py`, `api/app/services/variant_engine.py`, `api/app/services/experiment_factory.py`, `api/app/services/experiment_performance.py`

#### 4.1 Service Endpoints

```
# Pages
POST   /pages                              # Create page
GET    /pages?orgId                        # List pages
GET    /pages/:id
DELETE /pages/:id

# Zones
POST   /pages/:pageId/zones               # Create zone on page
GET    /pages/:pageId/zones
PUT    /zones/:id
DELETE /zones/:id

# Variants
POST   /zones/:zoneId/variants            # Create variant
GET    /zones/:zoneId/variants
PUT    /variants/:id
DELETE /variants/:id

# Experiments
POST   /experiments                        # Create experiment
GET    /experiments?orgId
GET    /experiments/:id
POST   /experiments/:id/start
POST   /experiments/:id/pause
POST   /experiments/:id/end
GET    /experiments/:id/results            # Stats + significance
POST   /experiments/:id/winner            # Declare winner

# Edge Resolver (performance-critical — Redis cached)
GET    /edge/resolve?url=&visitor_id=&segment=
# Returns: {zones: [{zoneId, variantId, html}]}
# SLA: <100ms. Cache key: org_id + page_url + visitor_segment
# Redis TTL: 60 seconds
```

#### 4.2 Traffic Allocation Logic

Reference: `api/app/services/experiment_engine.py` for bucketing, `api/app/services/bandit.py` for Thompson Sampling.

- **RANDOM mode**: hash(visitor_id + experiment_id) % 100 → assign variant by weight
- **BANDIT mode**: Thompson Sampling — sample from Beta(α=conversions+1, β=impressions-conversions+1) per variant. Assign variant with highest sample.

Update bandit parameters after each conversion event from Kafka.

#### 4.3 Statistical Significance

Reference: `api/app/services/experiment_analytics.py` for z-test implementation.

Two-proportion z-test:
- p1 = control conversions / control impressions
- p2 = treatment conversions / treatment impressions
- Confidence threshold: 95% (z-score > 1.96)
- Return: p-value, confidence %, lift %, recommended action

#### 4.4 Embed Script (loader.js)

Deploy as a static file from `accelerate-gateway` or CDN.

```javascript
// Customers add to their site: <script src="https://cdn.accelerate.inmobi.com/loader.js" data-org="ORG_ID"></script>

// loader.js does:
// 1. Get visitor_id from cookie (or generate + set)
// 2. GET /edge/resolve?url={current_url}&visitor_id={vid}&org={ORG_ID}
// 3. For each zone in response: document.querySelector(zone.selector).innerHTML = zone.html
// 4. Track impression: POST /pixel/experiment-impression
```

#### 4.5 Pixel-Service Extension (Phase 4)

Add to `accelerate-pixel-service`:
- `POST /experiment/impression` — track variant shown
- `POST /experiment/conversion` — track conversion
- Emit Kafka events: `experiment.impression`, `experiment.conversion`
- `accelerate-ingestion-service` writes to `ExperimentResult` table

#### 4.6 Frontend Pages (Phase 4)

- `apps/dashboard/app/organizations/[slug]/personalization/page.tsx`
  — Page list with zone count, active experiment count, best variant lift

- `apps/dashboard/app/organizations/[slug]/personalization/editor/page.tsx`
  — iframe-based visual editor. Click on page elements to define zones. WYSIWYG HTML editing per variant.

- `apps/dashboard/app/organizations/[slug]/experiments/page.tsx`
  — Experiment table: status, runtime, confidence, lift, spend saved

- `apps/dashboard/app/organizations/[slug]/experiments/[id]/live/page.tsx`
  — Real-time confidence meter, cumulative impressions/conversions per variant, statistical significance progress bar, "Declare Winner" button

---

### PHASE 5 — Product Feed Management (Multi-Platform)
**Service:** `accelerate-commerce-service` (extend)
**Adaptiv Reference:** `api/app/routers/product_feeds.py`, `api/app/routers/merchant_center.py`, `api/app/services/google_ad_uploader.py` (GMC section)

#### 5.1 Feed Endpoints

```
POST   /feeds                              # Create feed (connector + channel)
GET    /feeds?orgId
GET    /feeds/:id
DELETE /feeds/:id

GET    /feeds/:id/health                   # Health score + issues
                                           # Reference: api/app/routers/product_feeds.py /health endpoint
POST   /feeds/:id/generate                 # AI-optimize product titles/descriptions
                                           # Uses LiteLLM — reference Adaptiv's feed optimization prompt in product_feeds.py
POST   /feeds/:id/push                     # Push to channel (async via Kafka)
GET    /feeds/:id/products                 # Products in feed with overrides + labels
POST   /feeds/:id/rules                    # Add feed rule
GET    /feeds/:id/rules

# GMC
POST   /merchant-center/connect           # OAuth to GMC
GET    /merchant-center/status?orgId      # Connection + product approval stats
GET    /merchant-center/diagnostics?orgId # Per-product disapprovals
POST   /merchant-center/push?orgId        # Full Shopify→GMC or any connector→GMC sync
                                          # Reference: api/app/routers/merchant_center.py
```

#### 5.2 AI Feed Optimization

Reference: the product title/description optimization prompt in `api/app/routers/product_feeds.py`.

Rules for optimized titles (Google Shopping best practices):
- Lead with brand name
- Include key attributes: color, size, material
- Max 150 chars
- Include primary keyword

Use LiteLLM to rewrite titles/descriptions in batch. Apply as `FeedRule` override, not modifying the source `Product` record.

#### 5.3 Custom Label Assignment

Compute custom labels from `CommerceOrder` data (platform-agnostic):
- `best_seller` — top 20% by revenue in last 30 days
- `trending` — >50% velocity increase week-over-week
- `new_arrival` — product created in last 14 days
- `high_margin` — requires margin data (if available from connector)
- `zombie_sku` — no sales in 60+ days AND inventory > 0

Store in `Product.customLabels` JSON field. Feed push applies these as Google Shopping custom labels (0–4).

#### 5.4 Frontend Pages (Phase 5)

- `apps/dashboard/app/organizations/[slug]/feeds/page.tsx`
  — Feed list per channel with health score gauge, last push time, product count

- `apps/dashboard/app/organizations/[slug]/feeds/[id]/rules/page.tsx`
  — Rule builder: condition rows (field picker + operator + value), action rows, priority drag-sort

- `apps/dashboard/app/organizations/[slug]/feeds/merchant-center/page.tsx`
  — GMC connection status, product approval pie chart, top disapprovals list, "Push Feed" button

---

### PHASE 6 — Lead Generation
**Service:** `accelerate-campaign-service` (extend, Java Spring Boot)
**Adaptiv Reference:** `api/app/routers/leads.py` for endpoints, copilot.py lines 6397–6575 for create_lead_form logic and form field structure

#### 6.1 Lead Form Endpoints

```
POST   /leads/forms                        # Create lead form
GET    /leads/forms?orgId
GET    /leads/forms/:id
PUT    /leads/forms/:id
DELETE /leads/forms/:id

POST   /leads/forms/:id/publish           # Publish to selected hosting
GET    /leads/forms/:id/submissions       # Get captured leads
GET    /leads/forms/:id/submissions/export # CSV export

POST   /leads/capture/:formId             # Public — receive submission (no auth)
```

#### 6.2 Hosting Implementations

- **OWN_DOMAIN**: Generate a Next.js dynamic route at `/forms/[formId]` serving the form. Store published URL as `https://app.accelerate.inmobi.com/forms/:id`.
- **SHOPIFY**: Use `CommerceConnector` Shopify adapter to create a Shopify page with embedded form HTML. Requires active Shopify connector.
- **TYPEFORM**: Call Typeform API to create a form. Store `externalFormId`. Register Typeform webhook → `/leads/webhook/typeform` to capture submissions.
- **HUBSPOT**: Create HubSpot form via API. Store `externalFormId`. Register HubSpot webhook.

#### 6.3 Campaign Integration

When user clicks "Create Ad Campaign for This Form" in Accelera AI:
- AI calls `create_ad_campaign` tool with `objective: "lead_generation"` and `landing_url: form.publishedUrl`
- Campaign creation proceeds normally with lead gen objective on Meta/Google/Bing

#### 6.4 Frontend Pages (Phase 6)

- `apps/dashboard/app/organizations/[slug]/leads/page.tsx`
  — Form list with submission count, conversion rate, status

- `apps/dashboard/app/organizations/[slug]/leads/[id]/builder/page.tsx`
  — Drag-drop form field builder, incentive text, hosting selector, preview panel

- `apps/dashboard/app/organizations/[slug]/leads/[id]/submissions/page.tsx`
  — Submissions table: fields data, source URL, timestamp. CSV export.

---

### PHASE 7 — Analytics Intelligence
**Service:** `accelerate-reporting-service` (extend)
**Adaptiv Reference:** `api/app/services/analytics.py`, `api/app/routers/analytics.py`, `api/app/routers/ecommerce.py`, `api/app/routers/reporting.py`, `api/app/services/reporting_ingestion.py`, `api/app/services/llm_detector.py`, `api/app/routers/llm.py`, `api/app/routers/insights.py`

#### 7.1 New Reporting Endpoints

```
# Revenue Attribution
GET /reporting/attribution?orgId&days      # Ad-attributed vs organic split
GET /reporting/attribution/by-platform    # Revenue per ad platform
GET /reporting/attribution/trend          # Daily trend of ad vs organic

# Funnel Analysis
GET /reporting/funnel?orgId&from&to       # Full funnel: impressions→conversions
GET /reporting/funnel/by-platform

# Geographic Analytics
GET /reporting/geo?orgId&days             # Revenue + orders by country/state/city
                                          # Data source: CommerceOrder.metadata.geoLocation
                                          # Reference: api/app/routers/ecommerce.py geographic section

# Demographic + Placement
GET /reporting/demographics?orgId&days    # Age/gender from AdPlatformReport
GET /reporting/placements?orgId&days      # Feed vs Stories vs Reels vs Search

# LLM Traffic
GET /reporting/llm-traffic?orgId&days     # Bot traffic % trend
POST /reporting/llm-traffic/toggle        # Enable/disable LLM filtering in analytics

# Insights
GET /reporting/insights?orgId             # Auto-generated insights from anomaly detection
```

#### 7.2 LLM Traffic Detection

Reference: `api/app/services/llm_detector.py` for the user-agent pattern list and classification logic.

In `accelerate-pixel-service`:
- On every incoming event, check `user-agent` against known AI crawler patterns (GPTBot, Claude-Web, Googlebot-AI, PerplexityBot, etc.)
- Set `isLlmTraffic: true` on event
- Kafka event includes this flag
- Ingestion-service writes to BigQuery `pixel_events` with `is_llm_traffic` column
- Reporting queries filter or include based on org preference

#### 7.3 Frontend Pages (Phase 7)

- Extend `apps/dashboard/app/organizations/[slug]/reporting/page.tsx`
  — Add: funnel chart section, geographic heatmap (use react-simple-maps or Leaflet), demographic/placement breakdown tabs

- `apps/dashboard/app/organizations/[slug]/reporting/attribution/page.tsx`
  — Attribution waterfall: total revenue → ad platforms → organic. Time series.

- `apps/dashboard/app/organizations/[slug]/reporting/geo/page.tsx`
  — Interactive world/country map with revenue heatmap overlay + data table

- `apps/dashboard/app/organizations/[slug]/reporting/llm-traffic/page.tsx`
  — Bot traffic trend chart, % of total, top bot sources, toggle to filter from all analytics

---

### PHASE 8 — Campaign Optimization Agents + Keyword Planner + Journey Builder
**Service:** `accelerate-agent-service` (extend) + `accelerate-campaign-service` (extend)
**Adaptiv Reference:** `api/app/services/optimization_agent.py`, `api/app/services/agent_orchestrator.py`, `api/app/services/adk_agents.py`, `api/app/routers/keyword_planner.py`, `api/app/services/keyword_research.py`, `api/app/services/keyword_clustering.py`, `api/app/services/keyword_engine.py`, `api/app/routers/journeys.py`, `api/app/services/journey_engine.py`

#### 8.1 Optimization Agents (LangGraph — 7 Agents)

```python
# services/agent/optimization/agents/
#   budget_agent.py
#   bid_agent.py
#   creative_agent.py
#   audience_agent.py
#   anomaly_agent.py
#   pacing_agent.py
#   cmo_summary_agent.py
#   orchestrator.py

class OptimizationOrchestrator:
    """Runs all 7 agents in parallel via LangGraph Send() API"""
    async def run(org_id: str) -> list[OptimizationRecommendation]
```

Reference: `api/app/services/agent_orchestrator.py` for coordination pattern.
Reference: `api/app/services/adk_agents.py` for individual agent prompts and logic.

Each agent outputs a list of `OptimizationRecommendation` records written to Postgres.

Schedule: run via Kafka cron event daily for all active orgs.

Trigger on-demand via:
```
POST /optimization/run?orgId             # Run all agents
POST /optimization/run/:agentType?orgId  # Run single agent
GET  /optimization/recommendations?orgId&status
POST /optimization/recommendations/:id/apply
POST /optimization/recommendations/:id/dismiss
```

#### 8.2 Keyword Planner Agent

Reference: `api/app/routers/keyword_planner.py`, `api/app/services/keyword_research.py`, `api/app/services/keyword_clustering.py`, `api/app/services/keyword_engine.py`

```
POST /keyword-planner/research         # Seed keywords → volume + bid data (Google Ads KP API)
POST /keyword-planner/cluster          # AI clustering of keywords by intent
GET  /keyword-planner/sessions?orgId   # Saved research sessions
GET  /keyword-planner/sessions/:id
```

LangGraph agent flow:
1. Call Google Ads Keyword Planner API with seed keywords
2. LiteLLM clusters keywords by intent (informational / commercial / transactional)
3. Score keywords by: volume, competition, relevance, estimated CPC
4. Return clusters with recommended match types

#### 8.3 Journey Builder

Reference: `api/app/routers/journeys.py`, `api/app/services/journey_engine.py`

```
POST /journeys                         # Create journey
GET  /journeys?orgId
GET  /journeys/:id
PUT  /journeys/:id
POST /journeys/:id/activate
POST /journeys/:id/pause
GET  /journeys/:id/analytics           # Enrollment count, step completion, revenue
```

Step types:
- `email` — SendGrid template send (via `packages/email`)
- `ad` — Create retargeting audience from enrolled profiles + create campaign
- `delay` — wait N days before next step
- `condition` — branch based on event (purchased? opened email?)
- `sms` — future: SMS provider

Trigger execution via Kafka: when trigger event fires, `cdp-service` emits `journey.trigger.fired`, `campaign-service` picks it up and starts the journey for that profile.

#### 8.4 Campaign Health Scoring (Scheduled)

Run daily for all active campaigns:
```python
# Reference: api/app/services/campaign_health.py for scoring thresholds

for campaign in get_active_campaigns(org_id):
    metrics = get_last_7_day_metrics(campaign.id)
    score = compute_health_score(metrics)
    category = classify_campaign(score, metrics)  # WINNER/LEARNER/UNDERPERFORMER/BLEEDER
    recommendations = generate_recommendations(category, metrics)
    upsert CampaignHealthScore record
```

Expose via `accelerate-reporting-service`:
```
GET /reporting/campaign-health?orgId&date    # All campaigns with health scores
GET /reporting/campaign-health/:campaignId   # History for one campaign
```

#### 8.5 Frontend Pages (Phase 8)

- `apps/dashboard/app/organizations/[slug]/optimization/page.tsx`
  — Recommendation feed with priority badges (HIGH/MEDIUM/LOW), one-click "Apply" button, dismiss, impact estimate. Agent filter tabs.

- `apps/dashboard/app/organizations/[slug]/keyword-planner/page.tsx`
  — Seed keyword input, research trigger, cluster view with intent badges, keyword table with volume/CPC/competition, "Export to Campaign" button

- `apps/dashboard/app/organizations/[slug]/journeys/page.tsx`
  — Journey list with status, enrolled count, completion rate

- `apps/dashboard/app/organizations/[slug]/journeys/[id]/page.tsx`
  — Canvas-based journey node editor. Drag steps, connect with arrows, configure each node.

- `apps/dashboard/app/organizations/[slug]/campaigns/health/page.tsx`
  — Campaign health board: four quadrants (Winner/Learner/Underperformer/Bleeder), sparkline trends, recommended action per campaign

---

## 5. Intelligence Layer — Complete Coverage Confirmation

The following intelligence capabilities from Adaptiv are ALL covered in this plan:

| Intelligence Feature | Phase | Service | Adaptiv Reference |
|---|---|---|---|
| Campaign health scoring (W/L/U/B) | 2 + 8 | agent-service + reporting-service | `campaign_health.py`, `campaign_intelligence.py` |
| Wasted spend analysis | 2 | agent-service | copilot.py `analyze_wasted_spend` |
| AI CMO daily brief | 3 | agent-service | `ai_cmo.py` |
| AI CMO health score (0–100) | 3 | agent-service | `ai_cmo.py` |
| AI CMO forecast (30/60/90d) | 3 | agent-service | `ai_cmo.py` |
| AI CMO strategic plan | 3 | agent-service | `ai_cmo.py` |
| Media planning pipeline (6 agents) | 3 | agent-service | `media_planner_agents.py` |
| Blended ROAS / MER / executive summary | 2 | agent-service | copilot.py `get_executive_summary` |
| Revenue attribution (ad vs organic) | 2 + 7 | agent-service + reporting-service | copilot.py `get_revenue_breakdown`, `ecommerce.py` |
| Funnel analysis | 2 + 7 | agent-service + reporting-service | `analytics.py` |
| Wasted spend analysis | 2 | agent-service | copilot.py tool |
| Demographic insights (age/gender) | 2 | agent-service | copilot.py `get_demographic_insights` |
| Placement insights (Feed/Stories/Reels) | 2 | agent-service | copilot.py `get_placement_insights` |
| Geographic revenue breakdown | 2 + 7 | agent-service + reporting-service | `ecommerce.py` geographic section |
| Daily trends + anomaly detection | 2 | agent-service | copilot.py `get_daily_trends` |
| Cross-platform comparison | 2 | agent-service | copilot.py `get_platform_comparison` |
| LLM traffic detection | 7 | pixel-service + reporting-service | `llm_detector.py`, `llm.py` |
| 7 Optimization agents (budget, bid, creative, audience, anomaly, pacing, cmo) | 8 | agent-service | `adk_agents.py`, `optimization_agent.py` |
| Keyword planner + clustering | 8 | agent-service | `keyword_research.py`, `keyword_clustering.py` |
| Smart targeting recommendations | 2 | agent-service | copilot.py `smart_targeting` |
| Growth opportunity finder | 2 | agent-service | copilot.py `growth_opportunities` |
| Product performance intelligence | 2 | agent-service | `ad_creator.py` |
| Feed health scoring | 5 | commerce-service | `product_feeds.py` |
| GMC diagnostics | 5 | commerce-service | `merchant_center.py` |
| A/B experiment statistical significance | 4 | personalization-service | `experiment_analytics.py` |
| Multi-armed bandit allocation | 4 | personalization-service | `bandit.py` |
| Customer journey analytics | 8 | campaign-service | `journey_engine.py` |

---

## 6. Sidebar Navigation Additions

Add to `apps/dashboard/components/sidebar.tsx` in the following order (after existing items):

```
Accelera AI          [existing]
Dashboard            [existing]
New Campaign         [existing]
Campaigns            [existing]
  └── Campaign Health [new — Phase 8]
Reporting            [existing, enhanced]
  └── Attribution    [new — Phase 7]
  └── Geography      [new — Phase 7]
  └── LLM Traffic    [new — Phase 7]
Optimization         [new — Phase 8]
Media Planner        [new — Phase 3]
AI CMO               [new — Phase 3]
Keyword Planner      [new — Phase 8]
─────────────────────────────────────
Products             [new — Phase 1]
Commerce             [new — Phase 1]
Product Feeds        [new — Phase 5]
  └── Merchant Center
─────────────────────────────────────
CDP                  [new — Phase 1]
  └── Segments
Audiences            [existing, enhanced]
─────────────────────────────────────
Personalization      [new — Phase 4]
  └── Visual Editor
Experiments          [new — Phase 4]
Journeys             [new — Phase 8]
Lead Forms           [new — Phase 6]
─────────────────────────────────────
Platforms            [existing]
Assets               [existing]
Settings             [existing]
```

---

## 7. Kafka Topics — Complete List

| Topic | Producer | Consumer | Phase |
|---|---|---|---|
| `commerce.sync.requested` | gateway | commerce-service | 1 |
| `commerce.product.synced` | commerce-service | ingestion-service | 1 |
| `commerce.order.created` | commerce-service | ingestion-service, cdp-service | 1 |
| `commerce.revenue.updated` | commerce-service | ingestion-service | 1 |
| `cdp.profile.created` | cdp-service | ingestion-service | 1 |
| `cdp.segment.updated` | cdp-service | ingestion-service, campaign-service | 1 |
| `experiment.impression` | pixel-service | ingestion-service | 4 |
| `experiment.conversion` | pixel-service | personalization-service (bandit update) | 4 |
| `feed.push.requested` | gateway | commerce-service | 5 |
| `journey.trigger.fired` | pixel-service, cdp-service | campaign-service | 8 |
| `optimization.run.requested` | scheduler | agent-service | 8 |
| `optimization.recommendation.created` | agent-service | ingestion-service | 8 |
| `campaign.health.score.computed` | agent-service | ingestion-service | 8 |
| `llm.traffic.detected` | pixel-service | ingestion-service | 7 |

---

## 8. Environment Variables — New Services

### accelerate-commerce-service
```
DATABASE_URL=
KAFKA_BROKERS=
REDIS_URL=
LITELLM_API_KEY=
LITELLM_BASE_URL=
AES_ENCRYPTION_KEY=      # for connector credentials
GOOGLE_CONTENT_API_KEY=  # for GMC
```

### accelerate-cdp-service
```
DATABASE_URL=
KAFKA_BROKERS=
META_APP_ID=
META_APP_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
```

### accelerate-personalization-service
```
DATABASE_URL=
KAFKA_BROKERS=
REDIS_URL=               # edge resolver cache
CDN_BASE_URL=            # for loader.js
```

---

## 9. Migration Strategy for Existing Shopify-Coupled Models

The current schema has `ConnectedStore`, `ShoppingFeedSettings`, `FeedProduct`, `FeedRule`, `AudienceList` which are Shopify-coupled. Migration plan:

1. **Add new models** (`CommerceConnector`, `Product`, etc.) in migration `0002_commerce_abstraction`
2. **Write data migration script** in `packages/database/prisma/seed/migrate-commerce.ts`:
   - Map `ConnectedStore` → `CommerceConnector` with `platform: SHOPIFY`
   - Map `FeedProduct` → `Product` via `connectorId`
   - Map `FeedRule` → keep as-is, add `feedId` FK to new `ProductFeed`
   - Map `AudienceList` → `AudienceSegment`
3. **Mark old models** with `@deprecated` comment and `isLegacy Boolean @default(true)` field
4. **Remove old models** in migration `0010_remove_legacy` after all services consume new abstraction

---

## 10. Build Order (Strict)

```
Phase 1 (Commerce + CDP)            ← Start here. Unblocks everything.
    ↓
Phase 2 (Copilot 48 tools)          ← Needs Phase 1 for product/order tools
    ↓
Phase 3 (Media Planner + AI CMO)    ← Needs Phase 2 tools + Phase 1 data
    ↓ ↓ (Phases 4 and 5 can run in parallel)
Phase 4 (Personalization + A/B)     ← Independent of Phase 3
Phase 5 (Product Feeds + GMC)       ← Needs Phase 1 CommerceConnector
    ↓
Phase 6 (Lead Gen)                  ← Needs Phase 1 connectors (Shopify hosting)
    ↓
Phase 7 (Analytics Intelligence)    ← Needs Phase 1 commerce data + Phase 4 pixel events
    ↓
Phase 8 (Optimization + Keyword + Journeys) ← Needs all previous phases
```

---

## 11. What NOT to Do

- Do NOT create `shopify_*` named tables, columns, or variables anywhere in Accelerate
- Do NOT import from Adaptiv's codebase — rewrite all logic
- Do NOT put business logic in the gateway (BFF) — it routes only
- Do NOT use in-process Python dicts for session/rate-limit state — use Redis
- Do NOT call LLM APIs directly — always go through LiteLLM
- Do NOT use `any` type in TypeScript
- Do NOT store raw API credentials in the database unencrypted — AES-256 all connector credentials
- Do NOT create f-string SQL queries — use parameterized queries or BigQuery client library
- Do NOT make Adaptiv's mistake of a 9000-line monolithic file — one feature per file
- Do NOT skip Kafka for long-running operations — sync, feed push, optimization must be async

---

## 12. Gap Fills — Features Added After Full Cross-Check

*This section was added after a complete line-by-line audit of every Adaptiv router and service against the plan above. All items here are missing from Sections 4–8 and must be implemented.*

---

### 12.1 Missing Copilot Tools (Add to Phase 2 Tool Registry)

The following tools exist in Adaptiv's `copilot.py` TOOL_DEFINITIONS and were omitted from Phase 2:

| Tool Name | Adaptiv Reference | What It Does |
|---|---|---|
| `create_ad_campaign` | copilot.py tool handler ~line 3150 | Generic orchestrator: detects platform, dispatches to platform-specific creator. Handles lead gen path (landing_url instead of product_id). Must support `objective`: sales/traffic/awareness/lead_generation |
| `create_google_ad_campaign` | copilot.py ~line 4000, `google_ad_uploader.py` | Full Google Ads campaign: Search RSA, Display, PMax, Shopping PMax. Takes `campaign_type`, `product_id`, `daily_budget`, `keywords`, `geo_targets` |
| `create_bing_ad_campaign` | copilot.py ~line 5800, `bing_ad_uploader.py` | Full Bing Ads campaign: Search RSA, Audience ads, Shopping. Takes `campaign_type`, `product_id`, `daily_budget` |
| `generate_ad_creative` | copilot.py tool + `ad_creator.py` | AI image + copy generation. Calls creative-service (existing). Returns `creative_url` + `copy` dict. Styles: dramatic_dark, golden_hour, lifestyle |
| `get_campaign_metrics` | copilot.py `get_campaign_metrics` handler | Fetch KPIs for a specific campaign: spend, impressions, clicks, CTR, CPC, conversions, ROAS. Different from executive summary (campaign-level not aggregate) |
| `get_campaign_performance_history` | copilot.py tool | Historical performance trend for a campaign over time. Reads from BigQuery `campaign_insights_daily` |
| `get_experiment_results` | copilot.py `get_experiment_results` handler | Fetch A/B test results from personalization-service. Returns variant stats, significance, lift, winner. Phase 4 owns the data; this tool surfaces it in chat |
| `prepare_campaign_summary` | copilot.py tool | Pre-launch review card: product, creative preview, targeting summary, budget, estimated reach. Returns structured `campaign_summary_card` rich content for user to approve before launch |
| `auto_onboard` | copilot.py `auto_onboard` handler | Auto-onboarding: query top 5 products by revenue/velocity, suggest a campaign for each with recommended budget and platform. Returns onboarding plan card |
| `auto_create_campaigns_from_feed` | copilot.py tool | Batch campaign creation from product segments (best_sellers, trending, new_arrivals). Creates one campaign per segment across selected platforms |
| `suggest_optimizations` | copilot.py tool | Analyze all running campaigns and experiments for immediate action opportunities. Returns prioritized action list with one-click apply |
| `get_adk_agent_status` | copilot.py tool | Check optimization agent system health: which agents are enabled, queue depth, last run time, confidence scores |
| `setup_full_experiment` | copilot.py `setup_full_experiment` handler | One-shot: given a page URL → parse zones → generate variant HTML → create experiment. Calls personalization-service chain. Returns experiment ID + preview |
| `create_experiment` | copilot.py `create_experiment` handler | Create A/B experiment from chat: zone selector, variant HTML, traffic split. Calls personalization-service |
| `cmo_ask` | copilot.py `cmo_ask` handler, `ai_cmo.py` | NL question → BigQuery SQL → result. Add this as a CHAT TOOL (callable mid-conversation), not just a REST endpoint |
| `generate_media_plan` | copilot.py tool | Alias/shortcut for `media_planner` that triggers the 6-agent pipeline with budget param. Returns plan as rich `media_plan_card` |

**Implementation note:** `create_google_ad_campaign` and `create_bing_ad_campaign` already exist in Accelerate's campaign-service. The tools in agent-service must call campaign-service APIs, not re-implement the platform logic. The tool is the AI-facing interface; campaign-service is the execution engine.

**Rich card types to add to chat UI:**
- `campaign_summary_card` — pre-launch review (product image, targeting, budget, estimated reach, Approve/Cancel buttons)
- `experiment_results_card` — variant comparison table with confidence bar
- `onboarding_plan_card` — top products list with suggested campaigns and budgets
- `media_plan_card` — full media plan with platform allocation chart and 30/60/90 roadmap

---

### 12.2 Company Brief + Brand Guidelines (Add to Phase 2 — Creative Foundation)

**Adaptiv Reference:** `api/app/services/company_brief.py`, `api/app/services/brand.py`

These are foundational to all AI creative generation (ad copy, image prompts, variant HTML). Without them, the AI generates generic content that doesn't match the client's brand.

**Add to `accelerate-agent-service` — new module `agent-service/brand/`:**

```
agent-service/brand/
    company_brief.py    # auto-generate brand intelligence
    brand_guidelines.py # load + inject guidelines into prompts
```

**`company_brief.py` — Reference `api/app/services/company_brief.py`:**
- `generate_company_brief(org_id, website_url)` — LiteLLM analyzes business URL → extracts: business category, positioning statement, target audience, value proposition, tone of voice, key products/services, visual style
- `format_brief_for_image_prompt(brief)` — formats for Gemini Imagen prompts in creative-service
- `format_brief_for_copy_prompt(brief)` — formats for ad headline/description generation
- `format_brief_for_variant_prompt(brief)` — formats for landing page variant HTML generation

Store brief in Postgres. Add `CompanyBrief` model to schema:
```prisma
model CompanyBrief {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid @unique
  businessType   String?
  industry       String?
  positioning    String?  @db.Text
  targetAudience String?  @db.Text
  toneOfVoice    String?
  keywords       String[]
  visualStyle    String?
  primaryColor   String?
  logoUrl        String?
  generatedAt    DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**`brand_guidelines.py` — Reference `api/app/services/brand.py`:**
- `get_brand_guidelines(org_id)` → loads `CompanyBrief` + any manual overrides
- `format_for_prompt(guidelines)` → injects into all LiteLLM prompts as a system prefix
- Apply to: ad copy generation, creative prompts, media plan language, CMO brief tone

**Add copilot tool:**
- `update_company_brief` — allow user to update brief fields from chat ("Our tone is professional, not casual")
- `get_company_brief` — show current brand brief in chat

**Add to onboarding flow:** Auto-generate brief from `businessUrl` collected during onboarding (already in User model).

---

### 12.3 Cinematic Ad Engine (Add to Phase 2 — Creative Generation)

**Adaptiv Reference:** `api/app/services/cinematic_engine.py`

This is a distinct creative generation mode — not just "generate an image" but AI-directed product photography.

**Add to `accelerate-creative-service` — new module `creative-service/cinematic/`:**

**Flow:**
1. LiteLLM (Claude) analyzes product image via Vision → detailed scene description
2. LiteLLM generates a cinematic prompt for selected style:
   - **Dark Hero** — dramatic neon/studio lighting, dark background
   - **Golden Hour** — warm natural light, lifestyle context
   - **Action Motion** — dynamic, sports/energy theme
   - **Water Splash** — high-speed photography simulation
   - **Neon Studio** — futuristic, bold colors
   - **Lifestyle Premium** — luxury/aspirational setting
3. Gemini Imagen renders the full product scene
4. Pillow (Python) adds professional text overlay: brand name, price/discount badge, CTA text

**Add to chat as tool:**
- `generate_cinematic_creative(product_id, style, include_price, cta_text)` — returns creative URL
- Add `cinematic_card` rich content type with style selector + preview

**Endpoint in creative-service:**
```
POST /creative/cinematic
Body: {product_id, style, include_price, cta_text, org_id}
Returns: {creative_url, style, dimensions}
```

---

### 12.4 Campaign Verification System (Add to Phase 2 — Post-Launch Safety)

**Adaptiv Reference:** `api/app/services/campaign_verifier.py`

After every campaign creation, verify it was set up correctly on the platform. This catches API errors where the campaign "succeeded" but critical components (ads, targeting, conversion tracking) are missing.

**Add to `accelerate-campaign-service` — new module `campaign-service/verifier/`:**

**Verify per platform:**
- **Google:** check budget created → campaign exists → ad group created → ads uploaded → keywords added (Search) or assets uploaded (PMax) → conversion action linked
- **Meta:** check campaign created → ad set created → ad created → creative approved → pixel linked
- **Bing:** check campaign exists → ad group created → ads uploaded → keywords added

**Verification result stored in `CampaignVerification` model:**
```prisma
model CampaignVerification {
  id           String   @id @default(uuid()) @db.Uuid
  campaignId   String   @db.Uuid
  platform     String
  status       String   // passed | failed | partial
  checks       Json     // [{name, passed, detail}]
  verifiedAt   DateTime @default(now())
  campaign     Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}
```

**Trigger:** async via Kafka after campaign creation. Event: `campaign.created` → campaign-service verifier runs → writes result → emits `campaign.verified`.

**Surface in UI:** Verification status badge on campaign detail page (checkmark/warning/error with expandable check list).

**Add to copilot:** Automatically run after `create_ad_campaign` and report verification result in the same chat response.

---

### 12.5 Campaign Audit Log (Add to Phase 2)

**Adaptiv Reference:** `api/app/services/campaign_audit.py`

Every change to a campaign must be logged with before/after values and actor identity. Required for governance, debugging, and the optimization agent to understand what was changed and when.

**Add to `accelerate-campaign-service`:**

```prisma
model CampaignAuditLog {
  id           String   @id @default(uuid()) @db.Uuid
  campaignId   String   @db.Uuid
  organizationId String @db.Uuid
  actorType    String   // user | copilot | system | optimization_agent | cron
  actorId      String?  // userId or agentType
  changeType   String   // status_change | budget_change | archive | duplicate | targeting_change | create | verify
  previousValue Json?
  newValue     Json?
  note         String?
  occurredAt   DateTime @default(now())
  campaign     Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId, occurredAt])
  @@index([organizationId, occurredAt])
}
```

**Log these events automatically:**
- Campaign created (by whom: user/copilot/api)
- Status changed (paused ↔ active)
- Budget changed (old vs new value)
- Targeting changed (geo, audience, bid strategy)
- Archived / duplicated
- Optimization agent applied recommendation

**Endpoint:**
```
GET /campaigns/:id/audit-log     # Full audit trail for a campaign
GET /campaigns/audit-log?orgId   # Org-wide audit feed
```

---

### 12.6 UTM Rule Engine (Add to Phase 4 — Personalization)

**Adaptiv Reference:** `api/app/services/utm_rules.py`

The edge resolver uses UTM parameters to decide which variant to show. Example: visitors arriving via `utm_source=google&utm_campaign=pickleball-shoes` see a variant optimized for search intent.

**Add to `accelerate-personalization-service` — new module `personalization-service/utm/`:**

**`utm_rules.py` — Reference `api/app/services/utm_rules.py`:**
- `evaluate_utm_rules(utm_params, rules)` → returns matching rule or null
- Rule conditions: exact match, contains, regex, wildcard, starts_with
- UTM fields: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- Priority-ordered evaluation (first match wins)

**Add `UtmRule` model to Prisma:**
```prisma
model UtmRule {
  id          String              @id @default(uuid()) @db.Uuid
  zoneId      String              @db.Uuid
  variantId   String              @db.Uuid
  name        String
  priority    Int                 @default(0)
  conditions  Json                // [{field, operator, value}]
  isActive    Boolean             @default(true)
  zone        PersonalizationZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  variant     PageVariant         @relation(fields: [variantId], references: [id], onDelete: Cascade)
}
```

**Edge resolver update:** Before random/bandit allocation, check UTM rules first. If a rule matches, serve that specific variant regardless of experiment allocation.

Use case: Google Shopping visitors → see price-focused variant. Facebook visitors → see social proof variant.

---

### 12.7 Experiment Guardrails (Add to Phase 4)

**Adaptiv Reference:** `api/app/routers/guardrails.py`

Guardrails are secondary KPIs monitored alongside the primary experiment metric. If a guardrail is breached (e.g., bounce rate increases >20%), the experiment auto-pauses even if the primary metric (conversions) is improving.

**Add to `accelerate-personalization-service`:**

```prisma
model ExperimentGuardrail {
  id           String     @id @default(uuid()) @db.Uuid
  experimentId String     @db.Uuid
  metricName   String     // bounce_rate | session_duration | error_rate | revenue_per_visitor
  threshold    Float      // breach threshold value
  operator     String     // lt | gt | lte | gte (e.g. bounce_rate gt 0.8 = breach if >80%)
  status       String     @default("healthy") // healthy | warning | breached
  currentValue Float?
  lastCheckedAt DateTime?
  experiment   Experiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)
}
```

**Endpoints:**
```
POST /experiments/:id/guardrails       # Add guardrail to experiment
GET  /experiments/:id/guardrails       # List guardrails + current status
POST /experiments/:id/guardrails/check # Manually trigger guardrail check
```

**Auto-check:** Run guardrail check every time `ExperimentResult` is updated. If any guardrail is `breached`, auto-pause experiment and emit `experiment.guardrail.breached` Kafka event.

---

### 12.8 Personalization Pipeline Automation (Add to Phase 4)

**Adaptiv Reference:** `api/app/routers/pipeline.py`

One-shot automation that sets up the full personalization stack for a page URL without manual steps.

**Add to `accelerate-personalization-service`:**

```
POST /pipeline/auto-setup         # Full pipeline: URL → page → zones → variants → experiment
POST /pipeline/auto-variants/:pageId  # Generate variants for existing page + start bandit experiment
GET  /pipeline/status/:jobId      # Check async pipeline run status
```

**`auto-setup` flow (all async via Kafka):**
1. Given `url` + `org_id`
2. Fetch page HTML (headless browser or URL fetch)
3. LiteLLM identifies key zones (hero, CTA, product grid, testimonials)
4. For each zone: generate 2 variant HTML alternatives using company brief for brand voice
5. Create `SitePage`, `PersonalizationZone`, `PageVariant` records
6. Create `Experiment` with BANDIT allocation mode for each zone
7. Return: page ID + list of experiments created

**Add copilot tool:**
- `setup_full_experiment(page_url, org_id)` — triggers pipeline, streams progress, returns experiment summary

---

### 12.9 Visitor Tracking Endpoints (Add to Phase 1 — CDP)

**Adaptiv Reference:** `api/app/routers/visitors.py`

Explicit visitor profile endpoints for the CDP service (not just implicit through events).

**Add to `accelerate-cdp-service`:**

```
GET  /visitors?orgId&segment&deviceType&from&to&page   # Paginated visitor list with filters
POST /visitors                                          # Register new visitor (from loader.js)
GET  /visitors/:visitorId                              # Profile: identity sources, segments, event count
GET  /visitors/:visitorId/events                       # Full event history for visitor
PUT  /visitors/:visitorId/merge/:targetId             # Manual profile merge
```

**Visitor model** (add to Prisma — distinct from `CustomerProfile` which is order-based):
```prisma
model Visitor {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  cookieId       String   // from pixel cookie
  profileId      String?  @db.Uuid  // linked CustomerProfile (if identified)
  firstSeenAt    DateTime @default(now())
  lastSeenAt     DateTime @default(now())
  deviceType     String?  // desktop | mobile | tablet
  country        String?
  city           String?
  referrer       String?
  metadata       Json     @default("{}")
  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  profile        CustomerProfile? @relation(fields: [profileId], references: [id])

  @@unique([organizationId, cookieId])
  @@index([organizationId, lastSeenAt])
}
```

**Identity linking:** When visitor submits lead form or makes a purchase, link `Visitor.cookieId` → `CustomerProfile` via `CustomerIdentity` with `source: PIXEL`.

---

### 12.10 Event Tracking Schema (Add to Phase 1 — Pixel Service)

**Adaptiv Reference:** `api/app/routers/events.py`

Define the canonical event schema for all pixel events. Currently expansion plan says "pixel-service handles events" but doesn't specify the event types or data structure.

**Event types** (reference Adaptiv's events router):
```
page_view           — url, referrer, title, visitor_id
click               — element, selector, text, url
scroll              — depth_pct, time_on_page
impression          — element_id, zone_id, variant_id (for experiments)
conversion          — type, value, currency, product_id, order_id
form_submit         — form_id, fields_count
cta_click           — cta_text, destination_url
time_on_page        — seconds, scroll_depth
add_to_cart         — product_id, price, quantity
checkout_started    — cart_value, items_count
purchase            — order_id, revenue, items
experiment_impression — experiment_id, variant_id
experiment_conversion — experiment_id, variant_id, value
```

**Batch ingestion endpoint (add to `accelerate-pixel-service`):**
```
POST /events           # Single event
POST /events/batch     # Batch up to 100 events
```

**Event data shape:**
```typescript
interface PixelEvent {
  orgId: string
  visitorId: string       // cookie ID
  sessionId: string       // session-scoped ID
  eventType: EventType
  url: string
  referrer?: string
  properties: Record<string, unknown>
  isLlmTraffic: boolean   // auto-classified by LLM detector
  occurredAt: string      // ISO timestamp from client
}
```

Kafka topic: `pixel.event.raw` → ingestion-service classifies, enriches, writes to BigQuery.

---

### 12.11 Insights Engine (Add to Phase 7 — Analytics)

**Adaptiv Reference:** `api/app/routers/insights.py`, `api/app/services/insights.py`

The insights engine auto-generates prioritized, actionable observations from analytics data — like "Your bounce rate increased 23% this week" or "Product X is trending but has no active campaigns."

**Add to `accelerate-reporting-service`:**

**Insight types** (reference Adaptiv's insights service):
- Traffic anomaly (sudden spike or drop)
- Conversion rate change (significant week-over-week)
- Campaign budget exhaustion warning
- Product with high sales velocity but no campaign
- Experiment approaching significance
- Wasted spend detected (campaign spending with zero conversions)
- Audience saturation warning
- LLM traffic spike affecting analytics

**Endpoint:**
```
GET /reporting/insights?orgId&limit=10   # Top N prioritized insights
```

**Each insight:**
```typescript
interface Insight {
  id: string
  type: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  metric?: { name: string; value: number; change: number; changeType: 'increase' | 'decrease' }
  actionUrl?: string      // deep link to relevant dashboard section
  dismissedAt?: string
}
```

**Generation:** Run daily via Kafka cron. Each insight type has its own detector function that queries BigQuery. Write results to `InsightRecord` Postgres table with TTL.

```prisma
model InsightRecord {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  type           String
  priority       String
  title          String
  description    String   @db.Text
  metadata       Json     @default("{}")
  isDismissed    Boolean  @default(false)
  dismissedAt    DateTime?
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, isDismissed, expiresAt])
}
```

**Surface in UI:**
- `InsightsBanner` component on dashboard home — top 3 insights
- `Insights` tab in reporting page — full list with dismiss, priority filter

---

### 12.12 Widget Engine (Add to Phase 4 — Personalization)

**Adaptiv Reference:** `api/app/services/widget_engine.py`

Social proof and urgency widgets that can be embedded on client websites — separate from zone-based A/B testing. These are always-on overlays.

**Add to `accelerate-personalization-service`:**

**Widget types:**
- **Social proof** — "47 people viewing this" / "Purchased 12 minutes ago by Sarah in London"
- **Urgency** — "Only 3 left in stock!" / "Sale ends in 2:34:15"
- **Countdown timer** — Configurable end datetime with flip-clock style

**Prisma model:**
```prisma
model PersonalizationWidget {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  type           String   // social_proof | urgency | countdown
  config         Json     // type-specific: message templates, timing, styling
  targetUrl      String?  // apply only on specific page URLs (null = all pages)
  isActive       Boolean  @default(true)
  embedJs        String?  @db.Text  // generated embed snippet
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**Endpoints:**
```
POST   /widgets                  # Create widget
GET    /widgets?orgId            # List widgets
GET    /widgets/:id
PUT    /widgets/:id
DELETE /widgets/:id
GET    /widgets/:id/embed        # Get JS embed snippet
GET    /widgets/active?orgId&url # Get all active widgets for a URL (called by loader.js)
```

**Embed:** `loader.js` fetches active widgets for current URL and injects them into the page DOM. Widget JS is inlined in the response (no separate script fetch).

---

### 12.13 Rate Limiting for Copilot (Add to Phase 2)

**Adaptiv Reference:** `copilot.py` lines 90–106 (in-memory rate limiter — do NOT copy this pattern)

Adaptiv's rate limiter is in-process and breaks across multiple instances. Implement correctly using Redis.

**Add to `accelerate-agent-service`:**

```python
# agent-service/middleware/rate_limiter.py
# Uses Redis sliding window counter

COPILOT_RATE_LIMIT = 10          # messages per window
COPILOT_RATE_WINDOW_SECONDS = 60 # 1-minute window

async def check_rate_limit(org_id: str, redis: Redis) -> bool:
    key = f"rate:copilot:{org_id}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, COPILOT_RATE_WINDOW_SECONDS)
    return count <= COPILOT_RATE_LIMIT
```

Apply as FastAPI middleware on `POST /agent/chat`. Return HTTP 429 with `Retry-After` header if exceeded.

---

### 12.14 Real-Time Monitoring Dashboard (Add to Phase 7)

**Adaptiv Reference:** `web/src/app/dashboard/pulse/page.tsx`

Adaptiv has a "Pulse" page for real-time performance monitoring. Add equivalent to Accelerate.

**Add frontend page:** `apps/dashboard/app/organizations/[slug]/reporting/pulse/page.tsx`

**Displays (auto-refresh every 30s):**
- Live visitor count (last 5 minutes from pixel events)
- Conversions today vs yesterday at same time
- Active experiment count + top performer
- Campaign spend today vs daily budget (pacing)
- Top product by views (last hour)
- Recent events feed (last 10 events: purchases, form submits, add-to-carts)

**Backend:** WebSocket or SSE endpoint in reporting-service:
```
GET /reporting/pulse/stream?orgId    # SSE stream of real-time metrics
```

Polls BigQuery for aggregate metrics on 30s interval.

---

### 12.15 Updated Adaptiv Reference Map (Additions)

Add to Section 2 reference table:

| Adaptiv File | What to Extract | Used In Phase |
|---|---|---|
| `api/app/services/company_brief.py` | Brand brief auto-generation, prompt formatters | Phase 2 |
| `api/app/services/brand.py` | Brand guidelines loading, prompt injection | Phase 2 |
| `api/app/services/campaign_verifier.py` | Post-launch verification logic per platform | Phase 2 |
| `api/app/services/campaign_audit.py` | Audit log schema, actor types, change types | Phase 2 |
| `api/app/services/utm_rules.py` | UTM condition evaluator (exact/contains/regex) | Phase 4 |
| `api/app/routers/guardrails.py` | Guardrail check logic, auto-pause on breach | Phase 4 |
| `api/app/routers/pipeline.py` | Auto-setup orchestration flow | Phase 4 |
| `api/app/routers/visitors.py` | Visitor endpoint structure, filter params | Phase 1 |
| `api/app/routers/events.py` | Event types, batch ingestion, data shapes | Phase 1 |
| `api/app/routers/insights.py` | Insight types, priority schema | Phase 7 |
| `api/app/services/insights.py` | Insight detector logic per type | Phase 7 |
| `api/app/services/widget_engine.py` | Widget types, embed JS generation | Phase 4 |
| `api/app/services/cinematic_engine.py` | Cinematic prompt styles, image overlay logic | Phase 2 |
| `api/app/routers/copilot.py` lines 90–106 | Rate limiter pattern (reference only — use Redis) | Phase 2 |

---

### 12.16 Updated Prisma Schema Additions

Add these models to `packages/database/prisma/schema.prisma` in addition to those in Section 3:

```prisma
model CompanyBrief {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid @unique
  businessType   String?
  industry       String?
  positioning    String?  @db.Text
  targetAudience String?  @db.Text
  toneOfVoice    String?
  keywords       String[]
  visualStyle    String?
  primaryColor   String?
  logoUrl        String?
  generatedAt    DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model CampaignVerification {
  id         String   @id @default(uuid()) @db.Uuid
  campaignId String   @db.Uuid
  platform   String
  status     String   // passed | failed | partial
  checks     Json     // [{name, passed, detail}]
  verifiedAt DateTime @default(now())
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}

model CampaignAuditLog {
  id             String   @id @default(uuid()) @db.Uuid
  campaignId     String   @db.Uuid
  organizationId String   @db.Uuid
  actorType      String   // user | copilot | system | optimization_agent | cron
  actorId        String?
  changeType     String   // status_change | budget_change | archive | duplicate | targeting_change | create | verify
  previousValue  Json?
  newValue       Json?
  note           String?
  occurredAt     DateTime @default(now())
  campaign       Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId, occurredAt])
}

model UtmRule {
  id        String              @id @default(uuid()) @db.Uuid
  zoneId    String              @db.Uuid
  variantId String              @db.Uuid
  name      String
  priority  Int                 @default(0)
  conditions Json               // [{field, operator, value}]
  isActive  Boolean             @default(true)
  zone      PersonalizationZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  variant   PageVariant         @relation(fields: [variantId], references: [id], onDelete: Cascade)
}

model ExperimentGuardrail {
  id            String     @id @default(uuid()) @db.Uuid
  experimentId  String     @db.Uuid
  metricName    String
  threshold     Float
  operator      String     // lt | gt | lte | gte
  status        String     @default("healthy")
  currentValue  Float?
  lastCheckedAt DateTime?
  experiment    Experiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)
}

model PersonalizationWidget {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  type           String   // social_proof | urgency | countdown
  config         Json
  targetUrl      String?
  isActive       Boolean  @default(true)
  embedJs        String?  @db.Text
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model InsightRecord {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  type           String
  priority       String
  title          String
  description    String   @db.Text
  metadata       Json     @default("{}")
  isDismissed    Boolean  @default(false)
  dismissedAt    DateTime?
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, isDismissed, expiresAt])
}

model Visitor {
  id             String          @id @default(uuid()) @db.Uuid
  organizationId String          @db.Uuid
  cookieId       String
  profileId      String?         @db.Uuid
  firstSeenAt    DateTime        @default(now())
  lastSeenAt     DateTime        @default(now())
  deviceType     String?
  country        String?
  city           String?
  referrer       String?
  metadata       Json            @default("{}")
  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  profile        CustomerProfile? @relation(fields: [profileId], references: [id])

  @@unique([organizationId, cookieId])
  @@index([organizationId, lastSeenAt])
}
```

---

### 12.17 Updated Sidebar Navigation (Additions from Section 6)

```
Personalization      [Phase 4]
  └── Visual Editor
  └── Widgets          [new — Phase 4, Section 12.12]
Experiments          [Phase 4]
  └── [id]/live
Reporting
  └── Pulse            [new — Phase 7, Section 12.14]
  └── Attribution
  └── Geography
  └── LLM Traffic
  └── Insights         [new — Phase 7, Section 12.11]
```

---

### 12.18 Updated Kafka Topics (Additions from Section 7)

| Topic | Producer | Consumer | Phase |
|---|---|---|---|
| `campaign.created` | campaign-service | campaign-service (verifier) | 2 |
| `campaign.verified` | campaign-service (verifier) | reporting-service | 2 |
| `experiment.guardrail.breached` | personalization-service | campaign-service (auto-pause) | 4 |
| `pixel.event.raw` | pixel-service | ingestion-service | 1 |
| `insight.generate.requested` | scheduler | reporting-service | 7 |
| `pipeline.autosetup.requested` | gateway | personalization-service | 4 |

---

### 12.19 Complete Tool Registry — Final Count

After adding all missing tools, the complete Accelera AI tool registry contains:

**E-Commerce (6):** `get_products`, `get_sales`, `get_ecommerce_overview`, `get_inventory_health`, `get_product_insights`, `get_product_suggestions`

**Analytics (11):** `get_analytics_overview`, `get_platform_comparison`, `get_funnel_analysis`, `get_daily_trends`, `analyze_wasted_spend`, `get_demographic_insights`, `get_placement_insights`, `get_revenue_breakdown`, `get_sales_regions`, `get_executive_summary`, `query_reporting_data`

**Campaign Management (9):** `create_ad_campaign`, `create_google_ad_campaign`, `create_bing_ad_campaign`, `generate_ad_creative`, `generate_cinematic_creative`, `toggle_campaign`, `update_budget`, `get_campaign_metrics`, `get_campaign_performance_history`, `prepare_campaign_summary`

**Audience (6):** `list_audiences`, `create_custom_audience`, `create_lookalike_audience`, `get_audience_insights`, `smart_targeting`, `search_locations`

**Feeds + GMC (5):** `get_feed_health`, `generate_product_feed`, `push_feed_to_merchant_center`, `get_merchant_center_status`, `get_merchant_center_diagnostics`

**Lead Gen (2):** `create_lead_form`, `get_lead_submissions`

**Platform (3):** `get_connected_platforms`, `get_ad_platform_status`, `get_adk_agent_status`

**Strategy + Automation (9):** `suggest_campaign_strategy`, `get_campaign_strategies`, `growth_opportunities`, `auto_setup_everything`, `auto_onboard`, `auto_create_campaigns_from_feed`, `suggest_optimizations`, `setup_full_experiment`, `create_experiment`

**Planning + CMO (7):** `media_planner`, `generate_media_plan`, `cmo_brief`, `cmo_ask`, `cmo_health`, `cmo_forecast`, `cmo_plan`

**Brand (2):** `get_company_brief`, `update_company_brief`

**Total: 60 tools** (Adaptiv has 48 — Accelerate exceeds it due to split of some compound tools and addition of cinematic creative + brand tools)

---

*Section 12 added 2026-03-27 after full cross-check audit. File is now complete.*

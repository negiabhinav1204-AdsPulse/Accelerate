# Accelerate Platform — Microservices Deployment Runbook

All 7 Cloud Run services + Cloudflare gateway are built. This is the checklist to go live.

---

## Services Built

| Service | Directory | Week |
|---|---|---|
| Agent Service | `services/accelerate-agent-service` | 1 |
| Sync Service | `services/accelerate-sync-service` | 2 |
| Reporting Service | `services/accelerate-reporting-service` | 3 |
| Memory Service | `services/accelerate-memory-service` | 4 |
| Chat Service | `services/accelerate-chat-service` | 5 |
| Connector Service | `services/accelerate-connector-service` | 6 |
| Shopping Feeds Service | `services/accelerate-shopping-feeds-service` | 7 |
| API Gateway | `workers/accelerate-gateway` | 8 |

---

## Step 1 — GCP Setup (one-time)

```bash
gcloud projects create accelerate-platform --name="Accelerate Platform"
gcloud config set project accelerate-platform

gcloud services enable \
  run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com \
  cloudscheduler.googleapis.com

gcloud iam service-accounts create accelerate-services \
  --display-name="Accelerate Services CI/CD"

for ROLE in roles/run.developer roles/artifactregistry.writer roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding accelerate-platform \
    --member="serviceAccount:accelerate-services@accelerate-platform.iam.gserviceaccount.com" \
    --role="$ROLE"
done

# Download key → GitHub secret GCP_SA_KEY
gcloud iam service-accounts keys create gcp-sa-key.json \
  --iam-account=accelerate-services@accelerate-platform.iam.gserviceaccount.com
```

---

## Step 2 — GCP Secrets

```bash
# Generate shared internal key
INTERNAL_API_KEY=$(openssl rand -hex 32)

for SECRET in DATABASE_URL INTERNAL_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY \
              OPENAI_API_KEY CRON_SECRET STRIPE_SECRET_KEY SENDGRID_API_KEY; do
  echo -n "${!SECRET}" | gcloud secrets create $SECRET --data-file=-
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:accelerate-services@accelerate-platform.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

---

## Step 3 — GitHub Secrets

| Secret | Value |
|---|---|
| `GCP_PROJECT_ID` | `accelerate-platform` |
| `GCP_SA_KEY` | Contents of `gcp-sa-key.json` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare token (Workers:Edit permission) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

---

## Step 4 — Deploy Services

Push to `main` — all 7 GitHub Actions workflows trigger automatically.

After each service deploys, get its URL:
```bash
for SVC in agent sync reporting memory chat connector shopping-feeds; do
  echo "$SVC: $(gcloud run services describe accelerate-${SVC}-service --region us-central1 --format 'value(status.url)')"
done
```

---

## Step 5 — Vercel Environment Variables

```
INTERNAL_API_KEY=<from step 2>

AGENT_SERVICE_URL=https://accelerate-agent-service-XXXX-uc.a.run.app
SYNC_SERVICE_URL=https://accelerate-sync-service-XXXX-uc.a.run.app
REPORTING_SERVICE_URL=https://accelerate-reporting-service-XXXX-uc.a.run.app
MEMORY_SERVICE_URL=https://accelerate-memory-service-XXXX-uc.a.run.app
CHAT_SERVICE_URL=https://accelerate-chat-service-XXXX-uc.a.run.app
CONNECTOR_SERVICE_URL=https://accelerate-connector-service-XXXX-uc.a.run.app
SHOPPING_FEEDS_SERVICE_URL=https://accelerate-shopping-feeds-service-XXXX-uc.a.run.app

# Start ALL as false — enable one at a time (Step 8)
USE_AGENT_SERVICE=false
USE_SYNC_SERVICE=false
USE_REPORTING_SERVICE=false
USE_MEMORY_SERVICE=false
USE_CHAT_SERVICE=false
USE_CONNECTOR_SERVICE=false
USE_SHOPPING_FEEDS_SERVICE=false
```

---

## Step 6 — Cloud Scheduler (Sync Cron)

```bash
gcloud scheduler jobs create http accelerate-sync-cron \
  --location us-central1 \
  --schedule "0 */6 * * *" \
  --time-zone "UTC" \
  --uri "https://accelerate-sync-service-XXXX-uc.a.run.app/sync/cron" \
  --message-body '{}' \
  --headers "x-internal-api-key=INTERNAL_API_KEY,Content-Type=application/json" \
  --attempt-deadline 540s
```

---

## Step 7 — Cloudflare Gateway

```bash
cd workers/accelerate-gateway
npm install

# Create KV namespace for rate limiting
npx wrangler kv:namespace create RATE_LIMIT
# Paste the returned id and preview_id into wrangler.toml

# Set secrets
npx wrangler secret put DASHBOARD_URL
npx wrangler secret put SHOPPING_FEEDS_SERVICE_URL
npx wrangler secret put INTERNAL_API_KEY

# Deploy
npm run deploy:production
```

Then in Cloudflare DNS: point your domain to Vercel with orange cloud (proxy) enabled.

---

## Step 8 — Enable Services One at a Time

Enable each flag in Vercel (no redeploy needed), watch logs for 15 min, then proceed:

```
Day 1: USE_MEMORY_SERVICE=true        ← lowest risk
Day 2: USE_CHAT_SERVICE=true
Day 3: USE_SHOPPING_FEEDS_SERVICE=true
Day 4: USE_REPORTING_SERVICE=true
Day 5: USE_CONNECTOR_SERVICE=true     ← verify OAuth flows manually
Day 6: USE_SYNC_SERVICE=true
Day 7: USE_AGENT_SERVICE=true         ← update QStash webhook URL FIRST
```

**QStash webhook (before enabling Agent Service):**
QStash console → update webhook URL:
- From: `https://accelerate-dashboard-sable.vercel.app/api/campaign/worker`
- To: `https://accelerate-agent-service-XXXX-uc.a.run.app/run`
- Add header: `x-internal-api-key: YOUR_INTERNAL_API_KEY`

---

## Rollback Any Service (<2 min)

```bash
# Flip feature flag in Vercel env vars (instant, no redeploy):
USE_MEMORY_SERVICE=false

# Full monolith rollback:
git checkout v1.0.0-monolith-stable && vercel --prod
```

---

## Health Checks

```bash
# Check all services
for SVC in agent sync reporting memory chat connector shopping-feeds; do
  URL=$(gcloud run services describe accelerate-${SVC}-service --region us-central1 --format 'value(status.url)')
  echo "$SVC: $(curl -s -H 'x-internal-api-key: $INTERNAL_API_KEY' $URL/health | jq .status)"
done
```

---

## Cost Estimate (100k concurrent users)

| Resource | Monthly |
|---|---|
| 7x Cloud Run (auto-scale, min=0) | ~$100–300 |
| GCR image storage | ~$5 |
| Cloud Scheduler | ~$0.10 |
| Secret Manager | ~$0.60 |
| Cloudflare Workers | $0–5 |
| **Total** | **~$110–310/month** |

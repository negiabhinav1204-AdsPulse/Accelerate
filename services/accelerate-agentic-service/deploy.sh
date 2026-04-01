#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy.sh — builds on GCP Cloud Build and deploys to Cloud Run
# The entire build happens on GCP servers — nothing large is uploaded from Mac.
# Usage: ./deploy.sh
# ---------------------------------------------------------------------------
set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="asia-south1"
REPO="accelerate-ai"
SERVICE="accelerate-agentic-service"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: GCP project not set."
  exit 1
fi

if [[ ! -f "env.yaml" ]]; then
  echo "ERROR: env.yaml not found."
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploying: $SERVICE"
echo "  Project:   $PROJECT_ID"
echo "  Region:    $REGION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Enable APIs
echo "→ Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project="$PROJECT_ID" --quiet

# Create Artifact Registry repo
echo "→ Ensuring Artifact Registry repo..."
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || true

# Submit build to Cloud Build (builds entirely on GCP, ~10 min)
echo "→ Submitting to Cloud Build (builds on GCP — no large upload from Mac)..."
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project="$PROJECT_ID" \
  --substitutions="_REGION=${REGION},_REPO=${REPO},_SERVICE=${SERVICE}" \
  .

# ── Deploy to Cloud Run from terminal (avoids Cloud Build IAM issues) ──
echo "→ Deploying to Cloud Run..."

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:latest"

# Build env vars from env.yaml (skip comments and blank lines)
ENV_VARS=$(grep -v '^\s*#' env.yaml | grep -v '^\s*$' | \
  sed 's/: /=/' | sed 's/^[[:space:]]*//' | sed 's/"//g' | \
  tr '\n' ',' | sed 's/,$//')

gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=300s \
  --set-env-vars="$ENV_VARS"

echo ""
SERVICE_URL=$(gcloud run services describe "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)" 2>/dev/null || true)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy complete!"
if [[ -n "$SERVICE_URL" ]]; then
  echo ""
  echo "  Service URL: $SERVICE_URL"
  echo ""
  echo "  Add to Accelerate Vercel:"
  echo "  NEXT_PUBLIC_AGENTIC_SERVICE_URL=$SERVICE_URL"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

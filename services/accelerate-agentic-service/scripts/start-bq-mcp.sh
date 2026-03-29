#!/usr/bin/env bash
# Start the BigQuery MCP Toolbox locally.
#
# This runs the same MCP sidecar that K8s runs (see helm deployment.yaml).
# The agentic service connects to it at http://localhost:5001 (default ANALYTICS_MCP_URL).
#
# Prerequisites:
#   1. Go — https://go.dev/dl/
#   2. gcloud auth application-default login
#
# Usage:
#   ./scripts/start-bq-mcp.sh                              # uses default project
#   BIGQUERY_PROJECT=my-project ./scripts/start-bq-mcp.sh  # override project

set -euo pipefail

PROJECT="${BIGQUERY_PROJECT:-accelerate-nonprod-4e59}"
PORT="${MCP_PORT:-5001}"

# ── Find Go (check common install paths) ────────────────────────
if ! command -v go &>/dev/null; then
  for p in /usr/local/go/bin /opt/homebrew/bin "$HOME/go/bin"; do
    if [ -x "$p/go" ]; then
      export PATH="$p:$PATH"
      break
    fi
  done
fi
if ! command -v go &>/dev/null; then
  echo "Go not found. Install it from https://go.dev/dl/ and rerun."
  exit 1
fi

# ── Check gcloud credentials ────────────────────────────────────
ADC="$HOME/.config/gcloud/application_default_credentials.json"
if [ ! -f "$ADC" ]; then
  echo "No GCP credentials found. Run:"
  echo ""
  echo "  gcloud auth application-default login"
  echo ""
  exit 1
fi

# ── Ensure GOPATH/bin is on PATH ────────────────────────────────
GOPATH_BIN="$(go env GOPATH)/bin"
export PATH="$GOPATH_BIN:$PATH"

# ── Install toolbox if missing ──────────────────────────────────
if ! command -v genai-toolbox &>/dev/null; then
  echo "Installing MCP Toolbox..."
  go install github.com/googleapis/genai-toolbox@latest
  # Re-export in case GOPATH resolved differently during install
  export PATH="$(go env GOPATH)/bin:$PATH"
  echo "Toolbox installed."
fi

# ── Start ────────────────────────────────────────────────────────
echo "Starting BQ MCP Toolbox on :${PORT} (project: ${PROJECT})"
echo "Stop with Ctrl+C"
echo ""

export BIGQUERY_PROJECT="$PROJECT"
exec genai-toolbox --prebuilt=bigquery --port="$PORT" --address=0.0.0.0

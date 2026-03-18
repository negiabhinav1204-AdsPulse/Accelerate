# InMobi Accelerate

AI-Agentic Self-Serve Campaign Platform for SMBs and Agencies.

## Overview

InMobi Accelerate enables advertisers to go from a website URL to a fully optimized, cross-channel ad campaign running across Google, Meta, Bing, TikTok, and more — in under 5 minutes.

**Two flows:**
- **Accelera AI** — Natural language chat interface, any platform action via conversation
- **Manual Wizard** — Step-by-step campaign creation with AI suggestions

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/negiabhinav1204-AdsPulse/Accelerate.git
cd Accelerate

# 2. Copy environment template
cp .env.example .env
# Fill in your API keys in .env

# 3. Start infrastructure (requires Docker Desktop)
docker compose up -d

# 4. Start frontend
cd frontend && npm install && npm run dev

# 5. Start backend gateway
cd services/gateway && npm install && npm run dev
```

## Architecture

```
frontend/          → Next.js 14 (TypeScript, Tailwind, shadcn/ui)
services/
  gateway/         → Node.js BFF (API Gateway)
  auth/            → Authentication service
  campaign/        → Campaign management
  agent/           → AI agent orchestration (LangGraph)
  reporting/       → Analytics & reporting
  ingestion/       → Ad platform data ingestion
  creative/        → Image/video generation
  pixel/           → Event tracking
infra/             → Docker Compose, Terraform
shared/            → Shared types, schemas
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Chat UI | CopilotKit |
| State | Redux Toolkit |
| Gateway | Node.js + Fastify |
| AI Agents | Python + LangGraph + LiteLLM |
| Database | PostgreSQL 16 + Redis 7 |
| Analytics | BigQuery |
| Infrastructure | Docker, GCP Cloud Run |

## Development

See [feature-assist.md](./feature-assist.md) for full architectural reference.

## License

Proprietary — InMobi Technologies

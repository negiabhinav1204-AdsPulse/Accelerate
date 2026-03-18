# Accelerate — Feature Assist Reference

> **Usage:** Invoke this file at the start of every development session. It contains the canonical architectural and development decisions for the Accelerate platform. When writing specs or asking Claude to build something, reference this file for consistency.

---

## 1. Platform Identity
- **Product Name:** InMobi Accelerate
- **Chat Name:** Accelera AI
- **Type:** AI-Agentic Self-Serve Ad Campaign Platform (B2B, SMBs + Agencies)
- **PRD:** `/Users/abhinav.negi/Documents/Accelerate Master PRD.pdf` (v2.1)
- **Working Dir:** `/Users/abhinav.negi/Documents/Accelerate/`
- **Figma Extracted Screens:** `/Users/abhinav.negi/Downloads/accelerate-fig-extracted/key-screens/`
- **Figma Source:** `/Users/abhinav.negi/Downloads/Inmobi - accelerate (1).fig`
- **Live Domain (future):** accelerate.inmobi.com

---

## 2. Technology Stack (Chosen)

### Frontend
| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | **Next.js 14** (App Router) | SSR for landing pages, SEO, performance |
| Language | **TypeScript** | Type safety at scale |
| State | **Redux Toolkit + RTK Query** | PRD explicitly mentions Redux Store |
| UI Library | **shadcn/ui + Tailwind CSS** | Customizable, accessible, fast |
| Chat UI | **CopilotKit** | PRD requirement for dynamic chat UI rendering |
| Charts | **Recharts / Tremor** | Dashboards + analytics |
| i18n | **next-intl** | Multilingual from day 1 |
| Forms | **React Hook Form + Zod** | Validation, type-safe |

### Backend (Microservices)
| Service | Stack | Purpose |
|---------|-------|---------|
| accelerate-gateway | **Node.js + Fastify** (BFF) | API Gateway / BFF — transforms generalized schema → UI component JSON |
| accelerate-auth-service | **Node.js + Fastify** | Auth, JWT, OAuth, RBAC, sessions |
| accelerate-campaign-service | **Java 21 + Spring Boot** | Campaign CRUD, entity sync, recommendations (existing) |
| accelerate-ingestion-service | **Java 17 + Apache Spark** | Metrics from ad platforms → BigQuery (existing) |
| accelerate-db-service | **Python 3.12 + FastAPI** | Schema ownership, migrations (existing) |
| accelerate-reporting-service | **Python 3.12 + FastAPI** | BigQuery queries → reporting dashboards |
| accelerate-agent-service | **Python 3.12 + FastAPI** | All AI agent orchestration + LLM calls |
| accelerate-creative-service | **Python 3.12 + FastAPI** | Image/video generation, creative management |
| accelerate-pixel-service | **Node.js + Fastify** | Pixel event ingestion (high-throughput) |

### AI / Agent Layer
| Concern | Choice |
|---------|--------|
| Agent Framework | **LangGraph** (stateful multi-agent) |
| LLM Abstraction | **LiteLLM** (swap Claude/GPT/Gemini with config change) |
| Primary Analysis LLM | **Claude** (claude-sonnet-4-6) |
| Image Generation | **Gemini Imagen** |
| Content/Media Plan LLM | **Claude** (best for structured output) |
| RAG / Vector DB | **Weaviate** (self-hosted, GCP-compatible) |
| Session Memory | **Redis** |
| Long-term Memory (CFLA) | **PostgreSQL + Weaviate** |

### Data
| Store | Use |
|-------|-----|
| **PostgreSQL 16** | Transactional: users, orgs, campaigns, RBAC |
| **BigQuery** | Analytics: reporting metrics, data pipelines |
| **Redis 7** | Session cache, rate limiting, temp memory |
| **Weaviate** | Vector embeddings for RAG (CFLA, keyword suggestions) |
| **GCS (Google Cloud Storage)** | Assets: images, videos, creatives, feeds |

### Infrastructure
| Concern | Choice |
|---------|--------|
| Container Runtime | **Docker + Docker Compose** (local), **Cloud Run** (GCP) |
| API Gateway | **Kong** or **Cloud Endpoints** |
| Message Queue | **Apache Kafka** (data pipelines, async events) |
| Observability | **OpenTelemetry + Grafana + Loki** |
| Logging | **Structured JSON logs** → GCP Cloud Logging |
| CI/CD | **GitHub Actions** |
| IaC | **Terraform** (GCP) |

### Auth
- **JWT** (access + refresh tokens, short-lived)
- **Google OAuth 2.0** (SSO)
- **bcrypt** for password hashing
- **2FA** via TOTP (Google Authenticator compatible)
- Sensitive fields: AES-256 encrypted at rest

---

## 3. Generalized Schema (Core Contract)
```json
{
  "groupCampaignId": "uuid",
  "orgId": "uuid",
  "subAccountId": "uuid",
  "objective": "CONVERSIONS | TRAFFIC | AWARENESS | LEADS | APP_INSTALLS | SHOPPING",
  "platforms": ["GOOGLE", "META", "BING", "TIKTOK"],
  "budget": { "daily": 100, "total": 3000, "currency": "USD" },
  "schedule": { "startDate": "2026-03-18", "endDate": "2026-04-18" },
  "targeting": { "locations": [], "age": [], "gender": [], "devices": [], "interests": [] },
  "creatives": [{ "type": "IMAGE", "url": "", "headline": "", "description": "", "cta": "" }],
  "keywords": [{ "text": "", "matchType": "BROAD|PHRASE|EXACT", "bidOverride": null }],
  "biddingStrategy": "TARGET_CPA | MAXIMIZE_CONVERSIONS | MANUAL_CPC",
  "status": "DRAFT | ACTIVE | PAUSED | ARCHIVED"
}
```

---

## 4. Multi-Tenancy Model
```
Agency Org
└── Client Org (Advertiser)
    ├── Sub-Account (Brand/Website)
    │   ├── Connected MB Accounts (Google, Meta, etc.)
    │   └── Campaigns
    └── Team Members (RBAC per sub-account)
```

---

## 5. RBAC Roles (Confirmed)
| Role | Access |
|------|--------|
| Admin | Full access — new signup always gets this |
| Marketer | Campaign creation and management |
| Analyst | Read-only analytics and reporting |
| Finance | Billing, invoices, wallet |
| Developer | API keys, pixel, technical integrations |

Note: Invited users get the role assigned at invitation time and are scoped to the org they were invited to.

---

## 6. Development Agent Roster
| Agent | Responsibility |
|-------|---------------|
| Orchestration Agent | Breaks down tasks, assigns to agents, tracks progress |
| Frontend Agent | Next.js UI, components, pages, Redux |
| Backend Agent | FastAPI/Spring Boot services, business logic, APIs |
| DB Agent | PostgreSQL schema, migrations, BigQuery schemas |
| DevOps Agent | Docker, docker-compose, CI/CD, Cloud Run configs |
| ML Agent | LangGraph agents, LLM integrations, optimization models |
| Analytics Agent | BigQuery pipelines, reporting service, GA4 |
| Infra Agent | GCP setup, Terraform, networking, observability |

### Agent Contribution Tracking
Each agent appends to `/Users/abhinav.negi/Documents/Accelerate/agent-contributions.md`

---

## 7. Platform AI Agents
1. **Brand Analysis Agent** — URL scraping → brand identity (logo, colors, fonts, products)
2. **Landing Page URL Agent** — Keywords, product detection, price/discount, CTAs
3. **Trend Analysis Agent** — Industry trend signals
4. **Competitor Analysis Agent** — Competitor ad strategies
5. **Historical Data Agent** — Past campaign performance patterns
6. **Campaign Recommender Agent** — Synthesizes all → media plan
7. **Creative Generation Agent** — Images, videos, copy
8. **CFLA** — Feedback & learning, session + long-term memory
9. **Chat Agent (Accelera AI)** — CopilotKit, contextual memory, navigation
10. **Deep Analysis Agent** — On-demand strategic reports
11. **Keyword Planner Agent** — Research + bid estimation
12. **Budget Optimization Agent** — Cross-platform reallocation

---

## 8. Two Campaign Flows
### Flow A: Accelera AI (Chat)
`User NL Input → Chat Agent → LLM → Generalized Schema → Campaign Service → Platform APIs`

### Flow B: Manual Wizard
`Step-by-step form UI → BFF → Same Campaign Service → Same Platform APIs`

Both flows share identical backend APIs. Generalized Schema is the contract.

---

## 9. Non-Negotiable Constraints
- LLM-agnostic (LiteLLM abstraction layer)
- 100k concurrent user capacity
- Multilingual (i18n with next-intl from day 1)
- Multi-tenant with org isolation
- Security: bcrypt passwords, AES-256 sensitive data, OWASP compliance
- Structured logging with OpenTelemetry
- Test coverage >80% (agents write tests before confirming done)
- API response <200ms, UI load <2s
- Ad platform compliance checks before publish

---

## 10. Build Order — By User Journey (Confirmed)
Build by user journey, not module order. Always confirm with user before starting each journey.
1. **Login / Signup + Onboarding** ← START HERE
2. Org creation + RBAC
3. Supply Connectors (platform connections)
4. Accelera AI (Chat) + Campaign Creation (Agentic)
5. Campaign Dashboard & Management
6. Unified Reporting
7. Manual Campaign Creation Flow
8. Creative Engine
9. Billing & Payments
10. Remaining features per roadmap

---

## 11. Local Development Setup
```
/Users/abhinav.negi/Documents/Accelerate/
├── frontend/          # Next.js 14 app
├── services/
│   ├── gateway/       # Node.js BFF
│   ├── auth/          # Node.js auth service
│   ├── campaign/      # Java 21 Spring Boot
│   ├── ingestion/     # Java 17 + Spark
│   ├── db/            # Python FastAPI
│   ├── reporting/     # Python FastAPI
│   ├── agent/         # Python FastAPI + LangGraph
│   ├── creative/      # Python FastAPI
│   └── pixel/         # Node.js Fastify
├── infra/             # Docker Compose, Terraform
├── shared/            # Shared types, generalized schema
├── docs/              # Architecture diagrams
└── agent-contributions.md
```

---

## 12. Design System (from Figma)
- **Logo:** "inmobi" (gray) + "accelerate" (blue gradient) — stacked
- **Primary color:** Blue ~#3B82F6 (CTA buttons, active nav, links)
- **Background:** White cards on light blue gradient (#EEF4FF or similar)
- **Font:** Clean sans-serif (likely Inter or Poppins)
- **Layout:** Left sidebar (140px) + main content area + optional right slide-in panel
- **Sidebar nav items:** Accelera AI (⚡ RECOMMENDED badge), Dashboard, New Campaign, Campaign listing, Reporting, Optimization, Platforms, Assets | Bottom: Notifications, Settings, Support, Account
- **Cards:** White, subtle shadow, rounded corners
- **Buttons:** Blue primary (#3B82F6), white outline secondary
- **Top bar:** Org switcher (left), globe/settings/bell/avatar (right)
- **Chat input:** Bottom-centered, rounded, microphone + send icons, character counter

### Figma Screens Available
Located at: `/Users/abhinav.negi/Downloads/accelerate-fig-extracted/key-screens/`
Key screens: Sign_in_without_o_auth.jpg, accelerate_-_proto.jpg (Accelera AI home), AccelraChatEnhanced.jpg (campaign preview panel), Reporting_page.jpg, Dashboard.jpg, cd_* (campaign detail screens), cl_* (campaign listing screens)

---

## 13. Ad Platform Reports — Tier 1 (Launch with these)
Source: `SMB-Focused Priority Reports — Cross-Platform Ad Analytics (1).pdf`

### Google Ads (10 resources)
customer, campaign, ad_group, ad_group_ad, keyword_view, search_term_view, geographic_view, age_range_view, gender_view, conversion_action
Segments: date, device, ad_network_type

### Microsoft Bing (8 reports)
CampaignPerformance, AdGroupPerformance, AdPerformance, KeywordPerformance, SearchQueryPerformance, GeographicPerformance, AgeGenderAudience, ConversionPerformance

### Meta (4 objects + 5 insights)
Objects: campaigns, adsets, ads, adcreatives
Insights: campaign_daily, adset_daily, ad_daily, age_gender breakdown, platform_placement breakdown

**Total per client: ~27 tables, ~30 API calls/day** — manageable at scale.
Tier 2 (add after launch based on demand), Tier 3 (enterprise/on-demand) — see full report for details.

---

## 14. Key Files to Reference
- Memory: `/Users/abhinav.negi/.claude/projects/-Users-abhinav-negi-Documents-Accelerate/memory/`
- PRD: `/Users/abhinav.negi/Documents/Accelerate Master PRD.pdf`
- This file: `/Users/abhinav.negi/Documents/Accelerate/feature-assist.md`
- Agent contributions: `/Users/abhinav.negi/Documents/Accelerate/agent-contributions.md`
- Figma screens: `/Users/abhinav.negi/Downloads/accelerate-fig-extracted/key-screens/`
- Reports reference: `/Users/abhinav.negi/Downloads/SMB-Focused Priority Reports — Cross-Platform Ad Analytics (1).pdf`

## 15. Environment Setup
- **API keys:** Stored in `.env` files only — NEVER in code or chat
- **Ad Platform APIs:** Mock/dummy connections for now; real credentials to be added later
- **Database:** Docker Compose — PostgreSQL 16 + Redis 7 locally
- **GCP:** New project to be created (limited free credits); credentials shared separately
- **GitHub:** New repo to be created under user's personal account
- **Docker Desktop:** Needs reinstall if issues arise
- **Stripe:** Has account; publishable key available; secret key to be stored in .env only

# Campaign Reconciliation Engine + Audit/Versioning/Encryption Foundation

**Date:** 2026-06-25
**Status:** Approved (design)
**Author:** Abhinav Negi (with Claude Code)

## Context

We are porting two capabilities from the official InMobi Accelerate platform (a Java/Python microservice stack) into this Next.js 15 + Prisma + Fastify-services monorepo:

- **#5 — Audit trail + optimistic locking + field encryption** (the foundation)
- **#1 — DAG + 3-way state reconciliation for campaign publishing** (the engine)

These are sequenced together because the reconciliation engine depends on the foundation: it reads `lastAppliedState` and `version` columns and emits audited writes.

### Current state (grounding)

- Campaign domain is normalized: `Campaign → PlatformCampaign → AdGroup → Ad` (`packages/database/prisma/schema.prisma:770+`).
- No `version`, no `lastAppliedState`, no audit trail anywhere. An unrelated `AuditReport` model exists (audience audit — not an audit log).
- `ConnectedAdAccount.accessToken` / `refreshToken` are stored **plaintext** (`schema.prisma:545`). `CommerceConnector.credentials` is labeled AES-encrypted.
- An ad-hoc AES-256-CBC helper exists at `services/accelerate-sync-service/src/lib/encryption.ts` (decrypt only shown).
- `services/accelerate-campaigns-service/src/routes/publish.ts` is **create-only, fire-and-forget**: it creates campaigns on Meta/Google/Bing (status PAUSED) with no live read, no diff, no update/delete, and no rollback. It also writes `orgId`/`dailyBudget`, which do not match the `Campaign` schema (`organizationId`/`totalBudget`) — a latent bug.

## Goals

1. Field-level audit trail, optimistic locking, and at-rest encryption of secrets across the campaign domain + ad-account/commerce credentials.
2. A reconciliation engine that replaces the create-only publish path with a diff-driven, dependency-ordered, partial-failure-safe executor — and adds an edit/update path for live campaigns.
3. Design so true 3-way (live read-back) drift detection can be added later with no redesign.

## Non-goals

- Platform-wide audit/encryption beyond the campaign domain + secrets (deferred).
- Live read-back adapters for Meta/Google/Bing (3-way) — only the seam is built now.
- New ad-platform support beyond the current Meta/Google/Bing.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| #5 scope | Campaign domain (`Campaign/PlatformCampaign/AdGroup/Ad`) + secrets (`ConnectedAdAccount` tokens, `CommerceConnector.credentials`) |
| Reconciliation depth | 2-way now (desired vs last-applied), 3-way-ready seam |
| Audit mechanism | Single shared Prisma Client extension (auto audit + version bump + transparent field encryption) |
| Partial-failure behavior | Per-platform isolation: a failing platform rolls back its own created resources (best-effort), others proceed; everything recorded in a run log |

---

## Batch A — #5 Foundation

### A1. Schema changes (`packages/database/prisma/schema.prisma`)

New model:
```prisma
model AuditLog {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String?  @db.Uuid
  actorId        String?  @db.Uuid       // null for system
  actorType      String   @default("user") // user | agent | system
  entityType     String   @db.VarChar(64)  // "Campaign", "PlatformCampaign", ...
  entityId       String   @db.Uuid
  operation      String   @db.VarChar(16)  // CREATE | UPDATE | DELETE
  diff           Json                      // {field:{old,new}} for UPDATE; snapshot for C/D
  fromVersion    Int?
  toVersion      Int?
  requestId      String?  @db.VarChar(64)
  createdAt      DateTime @default(now())

  @@index([organizationId, entityType, entityId])
  @@index([createdAt])
}
```

Columns added to **Campaign, PlatformCampaign, AdGroup, Ad**:
- `version Int @default(1)` — optimistic lock, auto-bumped on update.
- `lastAppliedState Json?` — last payload successfully pushed to the platform. **On `PlatformCampaign`, `AdGroup`, `Ad` only**; `Campaign` is internal and gets `version` but no `lastAppliedState`.

### A2. Shared Prisma Client extension (`packages/database`)

A single `$extends` client extension wraps `create / update / delete / createMany / updateMany / deleteMany` for the audited models and does three things:

1. **Audit** — writes an `AuditLog` row with a field-level diff:
   - CREATE → snapshot of created fields as `{field:{old:null,new}}`.
   - UPDATE → only changed fields `{field:{old,new}}` (requires reading prior row in the same transaction).
   - DELETE → snapshot of deleted fields as `{field:{old,new:null}}`.
2. **Optimistic locking + version bump** — on UPDATE, if the caller supplies an expected `version` in the `where`/data, mismatch throws an `OptimisticLockError` (surfaced as HTTP 409). On success, `version` is incremented.
3. **Transparent field encryption** — encrypts designated fields on write and decrypts on read for: `ConnectedAdAccount.accessToken`, `ConnectedAdAccount.refreshToken`, `CommerceConnector.credentials`.

Writes happen inside a transaction so the audit row and the entity mutation commit atomically. A per-model config map (`AUDITED_MODELS`, `ENCRYPTED_FIELDS`) drives behavior so scope is data, not code.

### A3. Actor context (`packages/common`)

An `AsyncLocalStorage<RequestContext>` where `RequestContext = { actorId?, actorType, orgId?, requestId? }`.
- Dashboard (Next.js) middleware and each Fastify service populate it at request entry.
- Internal service-to-service calls propagate `X-User-Id` / `X-Org-Id` / `X-Request-Id` headers; the campaigns-service `verifyInternalKey` hook is extended to read them and seed the context.
- The Prisma extension reads this context for `actorId/actorType/organizationId/requestId`. Absent context → `actorType="system"`.

### A4. Encryption util (`packages/common/crypto`)

- Centralized AES-256-**GCM** with versioned format `v1:<iv>:<authTag>:<ciphertext>` (hex), key from `FIELD_ENCRYPTION_KEY` (32 bytes, base64/hex). Version prefix enables future key rotation.
- Exposes `encryptField(plaintext): string` and `decryptField(stored): string`; `decryptField` returns input unchanged if it lacks a known version prefix (read-compat with legacy plaintext until backfilled).
- Replaces `services/accelerate-sync-service/src/lib/encryption.ts` (kept as a thin re-export to avoid breaking imports, or updated call sites).
- **Backfill script** (`packages/database/scripts/encrypt-existing-secrets.ts`): finds `ConnectedAdAccount` rows whose tokens lack the `v1:` prefix and encrypts them in place. Idempotent.

---

## Batch B — #1 Reconciliation Engine

Location: `services/accelerate-campaigns-service/src/reconcile/`.

### B1. Resource graph (`graph.ts`)
Build one DAG **per platform** from desired DB state:
```
Budget → Campaign → AdGroup → Ad   (+ AdCreative for Meta)
```
Node: `{ type, localId, externalId?, desired, lastApplied?, deps[] }`. Edges encode prerequisite ordering.

### B2. Diff (`diff.ts`) — pure function
`diff(desired, lastApplied, live?)` per node:
| Condition | Action |
|---|---|
| no `lastApplied` and no `externalId` | CREATE |
| `lastApplied` present, desired changed | UPDATE (+ changed-field set) |
| equal | NO-OP |
| present in `lastApplied`, absent in desired | DELETE |

`live` is optional. Two args = 2-way (now). Adding `live` later enables drift detection / "platform wins" with no redesign.

### B3. Planner (`planner.ts`)
Topological sort (hand-rolled Kahn's algorithm, cycle guard) of each per-platform DAG into an ordered op list. No new dependency.

### B4. Platform adapters (`adapters/{meta,google,bing}.ts`)
```ts
interface PlatformAdapter {
  create(node): Promise<{ externalId: string }>;
  update(node, externalId, changedFields): Promise<void>;
  delete(externalId): Promise<void>;
  fetchLive?(externalId): Promise<LiveState>; // reserved for 3-way
}
```
- `create()` is the existing `publish.ts` logic refactored per platform (no behavior loss).
- `update()` initial coverage: status, budget, schedule. Structural changes fall back to delete+recreate (DAG supports it).
- `fetchLive` left unimplemented (3-way seam).

### B5. Executor (`executor.ts`) — per-platform isolation
- Platforms run in parallel; each platform's plan is its own unit.
- On a node failure within a platform: stop that platform, best-effort rollback (reverse-order delete of resources created in this run), record failure; other platforms continue.
- On node success: persist `externalId`, write `lastAppliedState`, bump `version` (via Batch-A extension → audited).
- Rollback failures are logged, never crash the run.

### B6. Run log (new Prisma models)
```prisma
model CampaignRun {
  id          String   @id @default(uuid()) @db.Uuid
  campaignId  String   @db.Uuid
  organizationId String @db.Uuid
  trigger     String   @db.VarChar(16) // publish | edit | retry
  status      String   @db.VarChar(16) // RUNNING | SUCCESS | PARTIAL | FAILED
  startedAt   DateTime @default(now())
  finishedAt  DateTime?
  items       CampaignRunItem[]
  @@index([campaignId])
}

model CampaignRunItem {
  id           String  @id @default(uuid()) @db.Uuid
  runId        String  @db.Uuid
  platform     String  @db.VarChar(50)
  resourceType String  @db.VarChar(50)
  localId      String? @db.Uuid
  externalId   String? @db.VarChar(255)
  operation    String  @db.VarChar(16) // CREATE | UPDATE | DELETE | NOOP
  status       String  @db.VarChar(16) // SUCCESS | FAILED | ROLLED_BACK | NOOP
  error        String? @db.Text
  durationMs   Int?
  run          CampaignRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  @@index([runId])
}
```

### B7. Integration
- Rewrite `POST /campaigns/publish`: upsert desired graph from `media_plan` → run engine → return `{ campaign_id, run_id, platform_results }` (same shape current consumers expect) → keep existing admin notifications (full / partial / failure). Fix the `orgId`/`dailyBudget` schema mismatch here.
- Add `POST /campaigns/:id/apply`: re-run engine after desired DB state is edited (UPDATE/DELETE actions fire) — the "edit a live campaign" path the platform lacks today.

---

## Error handling

- `OptimisticLockError` → HTTP 409.
- Platform API errors captured per node into `CampaignRunItem.error`; never abort sibling platforms.
- Partial success returns a structured per-platform/per-resource result; `CampaignRun.status = PARTIAL`.
- Rollback failures logged (with the orphaned `externalId`) but do not throw.

## Testing

**Unit**
- `diff`: full CREATE/UPDATE/NO-OP/DELETE matrix, incl. changed-field detection.
- `planner`: toposort ordering correctness + cycle guard.
- `crypto`: encrypt→decrypt round-trip; legacy-plaintext passthrough; tamper (bad authTag) rejection.
- Prisma extension: diff capture (C/U/D), version bump, optimistic-lock conflict, encrypt-on-write/decrypt-on-read.

**Integration**
- Engine with mocked adapters: clean publish; partial failure + rollback; edit/update path; no-op re-run.
- Backfill script idempotency.
- Existing publish behavior preserved through refactored `create` path.

## Implementation phasing

1. **A** foundation: schema migration (AuditLog + columns), crypto util, AsyncLocalStorage context, Prisma extension, token backfill. Ship + verify independently.
2. **B** engine: graph/diff/planner, adapters (refactor create + add update/delete), executor, run-log models, route rewrite + edit route.

## Risks / open notes

- The Prisma extension reading prior-row state on UPDATE adds a read per audited write; acceptable for campaign-domain volumes.
- `updateMany/deleteMany` can't cheaply diff each row — for audited models we either disallow them on audited paths or audit a coarse summary; default: coarse summary row noting affected count + filter.
- `FIELD_ENCRYPTION_KEY` must be provisioned in every service that touches encrypted fields and in CI/local `.env`.
- Reusing the existing `media_plan` ingestion shape keeps the agentic→campaigns contract stable.

# Campaign Reconciliation + Audit/Versioning/Encryption — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an audited, version-locked, encrypted data foundation to the campaign domain, then build a diff-driven dependency-graph reconciliation engine that replaces the create-only publish path and adds an edit path.

**Architecture:** A single shared Prisma Client extension provides audit logging, optimistic-lock version bumping, and transparent field encryption for designated models. A reconciliation engine in `accelerate-campaigns-service` builds a per-platform resource DAG from desired DB state, diffs it against `lastAppliedState` (2-way; 3-way-ready), topologically orders operations, and executes them through per-platform adapters with best-effort rollback, recording every step in a run log.

**Tech Stack:** TypeScript, Prisma 6.9, PostgreSQL, Fastify 4, Vitest (introduced by this plan), Node crypto (AES-256-GCM), `AsyncLocalStorage`.

## Global Constraints

- Node `>=20`; pnpm `9.12.0`; all packages `"type": "module"`.
- Prisma client version pinned `6.9.0` everywhere.
- `@workspace/common` exposes per-file `exports` entries — every new file must be added to its `exports` map.
- `#5` scope is **campaign domain only** (`Campaign`, `PlatformCampaign`, `AdGroup`, `Ad`) plus secrets (`ConnectedAdAccount.accessToken`/`refreshToken`, `CommerceConnector.credentials`). Do not audit/encrypt other models.
- Reconciliation is **2-way now** (`desired` vs `lastAppliedState`); the `diff()` and adapter interfaces must accept an optional `live` arg / expose an optional `fetchLive` for later 3-way, left unimplemented.
- Partial-failure behavior is **per-platform isolation**: a failing platform rolls back only its own created resources (best-effort), other platforms proceed, all outcomes recorded in `CampaignRun`/`CampaignRunItem`.
- Encryption format: `v1:<ivHex>:<authTagHex>:<ciphertextHex>`, AES-256-GCM, key from `FIELD_ENCRYPTION_KEY`. `decryptField` must pass through values lacking a known version prefix (legacy plaintext read-compat).
- DB-dependent tests use the local `accelerate` database via `DATABASE_URL`; tests must clean up rows they create.
- Commit after every task. Branch is `feat/campaign-reconciliation-audit-foundation`.

---

# Phase A — Foundation (audit + optimistic locking + encryption)

## Task 1 (A0): Vitest tooling

**Files:**
- Create: `vitest.workspace.ts` (repo root)
- Modify: `turbo.json` (add `test` task)
- Modify: `packages/common/package.json`, `packages/database/package.json`, `services/accelerate-campaigns-service/package.json` (add `test` script + devDeps)
- Create: `packages/common/vitest.config.ts`, `packages/database/vitest.config.ts`, `services/accelerate-campaigns-service/vitest.config.ts`

**Interfaces:**
- Produces: a working `pnpm --filter <pkg> test` (runs `vitest run`) in the three workspaces.

- [ ] **Step 1: Add Vitest devDependency to the three workspaces**

In each of `packages/common/package.json`, `packages/database/package.json`, `services/accelerate-campaigns-service/package.json`, add to `devDependencies`:
```json
"vitest": "2.1.9"
```
and add to `scripts`:
```json
"test": "vitest run"
```

- [ ] **Step 2: Create per-package vitest configs**

`packages/common/vitest.config.ts` (identical file in `packages/database/` and `services/accelerate-campaigns-service/`):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globals: false,
  },
});
```

- [ ] **Step 3: Add a `test` task to `turbo.json`**

Inside `"tasks"` add:
```json
"test": { "dependsOn": ["^build"], "outputs": [] }
```

- [ ] **Step 4: Install and create a smoke test**

Create `packages/common/src/smoke.test.ts`:
```ts
import { test, expect } from 'vitest';
test('vitest runs', () => { expect(1 + 1).toBe(2); });
```
Run: `pnpm install`

- [ ] **Step 5: Run the smoke test**

Run: `pnpm --filter @workspace/common test`
Expected: PASS (1 test). Then delete `packages/common/src/smoke.test.ts`.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "chore: add vitest test runner to common, database, campaigns-service"
```

---

## Task 2 (A1): Field encryption util (`@workspace/common/crypto`)

**Files:**
- Create: `packages/common/src/crypto.ts`
- Create: `packages/common/src/crypto.test.ts`
- Modify: `packages/common/package.json` (exports map)

**Interfaces:**
- Produces:
  - `encryptField(plaintext: string): string` → `v1:<ivHex>:<tagHex>:<ctHex>`
  - `decryptField(stored: string): string` (passes through non-`v1:` input)
  - `isEncrypted(value: string): boolean`

- [ ] **Step 1: Write the failing test**

`packages/common/src/crypto.test.ts`:
```ts
import { test, expect, beforeAll } from 'vitest';
import { encryptField, decryptField, isEncrypted } from './crypto';

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64); // 32 bytes hex
});

test('round-trips plaintext', () => {
  const enc = encryptField('super-secret-token');
  expect(enc).not.toContain('super-secret-token');
  expect(enc.startsWith('v1:')).toBe(true);
  expect(decryptField(enc)).toBe('super-secret-token');
});

test('passes through legacy plaintext on decrypt', () => {
  expect(decryptField('legacy-plaintext')).toBe('legacy-plaintext');
});

test('isEncrypted detects prefix', () => {
  expect(isEncrypted(encryptField('x'))).toBe(true);
  expect(isEncrypted('nope')).toBe(false);
});

test('tampered ciphertext throws', () => {
  const enc = encryptField('secret');
  const parts = enc.split(':');
  parts[3] = parts[3].replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
  expect(() => decryptField(parts.join(':'))).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/common test`
Expected: FAIL ("Cannot find module './crypto'").

- [ ] **Step 3: Implement the crypto util**

`packages/common/src/crypto.ts`:
```ts
import crypto from 'node:crypto';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error('FIELD_ENCRYPTION_KEY is not set');
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY must decode to 32 bytes (256-bit)');
  }
  return key;
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) return stored; // legacy plaintext
  const [, ivHex, tagHex, ctHex] = stored.split(':');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
```

- [ ] **Step 4: Add the export entry**

In `packages/common/package.json` `exports`, add:
```json
"./crypto": "./src/crypto.ts"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @workspace/common test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**
```bash
git add packages/common/src/crypto.ts packages/common/src/crypto.test.ts packages/common/package.json
git commit -m "feat(common): AES-256-GCM field encryption util with versioned format"
```

---

## Task 3 (A2): Request context (`@workspace/common/context`)

**Files:**
- Create: `packages/common/src/context.ts`
- Create: `packages/common/src/context.test.ts`
- Modify: `packages/common/package.json` (exports map)

**Interfaces:**
- Produces:
  - `type ActorType = 'user' | 'agent' | 'system'`
  - `interface RequestContext { actorId?: string; actorType: ActorType; orgId?: string; requestId?: string }`
  - `runWithContext<T>(ctx: RequestContext, fn: () => T): T`
  - `getContext(): RequestContext` (defaults to `{ actorType: 'system' }`)

- [ ] **Step 1: Write the failing test**

`packages/common/src/context.test.ts`:
```ts
import { test, expect } from 'vitest';
import { runWithContext, getContext } from './context';

test('defaults to system actor outside any scope', () => {
  expect(getContext()).toEqual({ actorType: 'system' });
});

test('exposes context inside scope', () => {
  const out = runWithContext(
    { actorId: 'u1', actorType: 'user', orgId: 'o1', requestId: 'r1' },
    () => getContext(),
  );
  expect(out).toEqual({ actorId: 'u1', actorType: 'user', orgId: 'o1', requestId: 'r1' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/common test`
Expected: FAIL ("Cannot find module './context'").

- [ ] **Step 3: Implement the context**

`packages/common/src/context.ts`:
```ts
import { AsyncLocalStorage } from 'node:async_hooks';

export type ActorType = 'user' | 'agent' | 'system';

export interface RequestContext {
  actorId?: string;
  actorType: ActorType;
  orgId?: string;
  requestId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();
const SYSTEM: RequestContext = { actorType: 'system' };

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext {
  return storage.getStore() ?? SYSTEM;
}
```

- [ ] **Step 4: Add the export entry**

In `packages/common/package.json` `exports`, add:
```json
"./context": "./src/context.ts"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @workspace/common test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**
```bash
git add packages/common/src/context.ts packages/common/src/context.test.ts packages/common/package.json
git commit -m "feat(common): AsyncLocalStorage request context for audit actor propagation"
```

---

## Task 4 (A3): Schema migration — AuditLog + version + lastAppliedState

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create (generated): `packages/database/prisma/migrations/<timestamp>_audit_foundation/migration.sql`

**Interfaces:**
- Produces: `AuditLog` model; `version Int @default(1)` on `Campaign/PlatformCampaign/AdGroup/Ad`; `lastAppliedState Json?` on `PlatformCampaign/AdGroup/Ad`.

- [ ] **Step 1: Add the `AuditLog` model**

Append to `packages/database/prisma/schema.prisma`:
```prisma
model AuditLog {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String?  @db.Uuid
  actorId        String?  @db.Uuid
  actorType      String   @default("user") @db.VarChar(16)
  entityType     String   @db.VarChar(64)
  entityId       String   @db.Uuid
  operation      String   @db.VarChar(16)
  diff           Json
  fromVersion    Int?
  toVersion      Int?
  requestId      String?  @db.VarChar(64)
  createdAt      DateTime @default(now())

  @@index([organizationId, entityType, entityId])
  @@index([createdAt])
}
```

- [ ] **Step 2: Add columns to the four campaign-domain models**

In `model Campaign` add: `version Int @default(1)`
In `model PlatformCampaign` add: `version Int @default(1)` and `lastAppliedState Json?`
In `model AdGroup` add: `version Int @default(1)` and `lastAppliedState Json?`
In `model Ad` add: `version Int @default(1)` and `lastAppliedState Json?`

- [ ] **Step 3: Create and apply the migration**

Run:
```bash
pnpm --filter @workspace/database exec prisma migrate dev --name audit_foundation
```
Expected: migration created and applied; `prisma generate` runs.

- [ ] **Step 4: Verify columns exist**

Run:
```bash
psql "$DATABASE_URL" -tAc "select column_name from information_schema.columns where table_name='PlatformCampaign' and column_name in ('version','lastAppliedState') order by 1;"
```
Expected: `lastAppliedState` and `version`.

- [ ] **Step 5: Commit**
```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(database): AuditLog model + version/lastAppliedState on campaign domain"
```

---

## Task 5 (A4): Diff helper for audit

**Files:**
- Create: `packages/database/src/audit/diff.ts`
- Create: `packages/database/src/audit/diff.test.ts`

**Interfaces:**
- Produces: `computeFieldDiff(before: Record<string, unknown>, after: Record<string, unknown>, fields: string[]): Record<string, { old: unknown; new: unknown }>` — only fields whose JSON value changed.

- [ ] **Step 1: Write the failing test**

`packages/database/src/audit/diff.test.ts`:
```ts
import { test, expect } from 'vitest';
import { computeFieldDiff } from './diff';

test('captures only changed fields', () => {
  const d = computeFieldDiff(
    { name: 'A', budget: 10, status: 'draft' },
    { name: 'A', budget: 20, status: 'paused' },
    ['name', 'budget', 'status'],
  );
  expect(d).toEqual({
    budget: { old: 10, new: 20 },
    status: { old: 'draft', new: 'paused' },
  });
});

test('deep-compares json values', () => {
  const d = computeFieldDiff(
    { targeting: { age: [18, 35] } },
    { targeting: { age: [18, 45] } },
    ['targeting'],
  );
  expect(d.targeting).toEqual({ old: { age: [18, 35] }, new: { age: [18, 45] } });
});

test('returns empty when nothing changed', () => {
  expect(computeFieldDiff({ a: 1 }, { a: 1 }, ['a'])).toEqual({});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/database test`
Expected: FAIL ("Cannot find module './diff'").

- [ ] **Step 3: Implement**

`packages/database/src/audit/diff.ts`:
```ts
export function computeFieldDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): Record<string, { old: unknown; new: unknown }> {
  const out: Record<string, { old: unknown; new: unknown }> = {};
  for (const f of fields) {
    const a = before?.[f];
    const b = after?.[f];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[f] = { old: a ?? null, new: b ?? null };
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/database test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add packages/database/src/audit/diff.ts packages/database/src/audit/diff.test.ts
git commit -m "feat(database): field-level diff helper for audit logging"
```

---

## Task 6 (A5): Audited/encrypted Prisma client extension

**Files:**
- Create: `packages/database/src/audit/config.ts`
- Create: `packages/database/src/audit/extension.ts`
- Create: `packages/database/src/audit/extension.test.ts`
- Modify: `packages/database/src/client.ts`
- Modify: `packages/database/src/index.ts`

**Interfaces:**
- Consumes: `computeFieldDiff` (A4), `getContext` (`@workspace/common/context`), `encryptField`/`decryptField`/`isEncrypted` (`@workspace/common/crypto`).
- Produces:
  - `AUDITED_MODELS: Record<string, { fields: string[] }>` and `ENCRYPTED_FIELDS: Record<string, string[]>` in `config.ts`.
  - `withAuditAndEncryption(base: PrismaClient): ExtendedClient` in `extension.ts`.
  - `class OptimisticLockError extends Error`.
  - Updated `prisma` singleton (exported from `client.ts`) now wrapped by the extension.

- [ ] **Step 1: Write the config**

`packages/database/src/audit/config.ts`:
```ts
export const AUDITED_MODELS: Record<string, { fields: string[]; hasLastApplied: boolean }> = {
  Campaign: {
    hasLastApplied: false,
    fields: ['name', 'objective', 'status', 'totalBudget', 'currency', 'startDate', 'endDate', 'targetAudience', 'mediaPlan'],
  },
  PlatformCampaign: {
    hasLastApplied: true,
    fields: ['platform', 'adTypes', 'budget', 'currency', 'status', 'platformCampaignId', 'settings', 'lastAppliedState'],
  },
  AdGroup: {
    hasLastApplied: true,
    fields: ['name', 'adType', 'targeting', 'bidStrategy', 'status', 'platformAdGroupId', 'lastAppliedState'],
  },
  Ad: {
    hasLastApplied: true,
    fields: ['adType', 'headlines', 'descriptions', 'imageUrls', 'videoUrl', 'ctaText', 'destinationUrl', 'status', 'platformAdId', 'metadata', 'lastAppliedState'],
  },
};

export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  ConnectedAdAccount: ['accessToken', 'refreshToken'],
  CommerceConnector: ['credentials'],
};
```

- [ ] **Step 2: Write the failing test (uses the local DB)**

`packages/database/src/audit/extension.test.ts`:
```ts
import { test, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { withAuditAndEncryption, OptimisticLockError } from './extension';
import { runWithContext } from '@workspace/common/context';

const base = new PrismaClient();
const prisma = withAuditAndEncryption(base);
let orgId: string;

beforeAll(async () => {
  process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64);
  const org = await base.organization.create({ data: { name: 'audit-test-org', slug: `audit-${Date.now()}` } as any });
  orgId = org.id;
});

afterAll(async () => {
  await base.auditLog.deleteMany({ where: { organizationId: orgId } });
  await base.campaign.deleteMany({ where: { organizationId: orgId } });
  await base.organization.delete({ where: { id: orgId } });
  await base.$disconnect();
});

test('writes CREATE audit row with actor from context', async () => {
  const c = await runWithContext({ actorId: orgId, actorType: 'user', orgId }, () =>
    prisma.campaign.create({ data: { organizationId: orgId, createdBy: orgId, name: 'C1', objective: 'SALES' } }),
  );
  const logs = await base.auditLog.findMany({ where: { entityId: c.id, operation: 'CREATE' } });
  expect(logs).toHaveLength(1);
  expect(logs[0].actorType).toBe('user');
  expect(c.version).toBe(1);
});

test('UPDATE bumps version and records changed-field diff', async () => {
  const c = await prisma.campaign.create({ data: { organizationId: orgId, createdBy: orgId, name: 'C2', objective: 'SALES' } });
  const u = await prisma.campaign.update({ where: { id: c.id }, data: { name: 'C2-renamed' } });
  expect(u.version).toBe(2);
  const log = await base.auditLog.findFirst({ where: { entityId: c.id, operation: 'UPDATE' } });
  expect((log!.diff as any).name).toEqual({ old: 'C2', new: 'C2-renamed' });
});

test('optimistic lock conflict throws OptimisticLockError', async () => {
  const c = await prisma.campaign.create({ data: { organizationId: orgId, createdBy: orgId, name: 'C3', objective: 'SALES' } });
  await expect(
    prisma.campaign.update({ where: { id: c.id, version: 999 } as any, data: { name: 'x' } }),
  ).rejects.toBeInstanceOf(OptimisticLockError);
});

test('encrypts ConnectedAdAccount token at rest, decrypts on read', async () => {
  const acct = await prisma.connectedAdAccount.create({
    data: { organizationId: orgId, platform: 'meta', accountId: 'a1', accountName: 'n', accessToken: 'plain-token' },
  });
  const raw = await base.$queryRawUnsafe<any[]>(`select "accessToken" from "ConnectedAdAccount" where id = $1`, acct.id);
  expect(raw[0].accessToken.startsWith('v1:')).toBe(true);
  const read = await prisma.connectedAdAccount.findUnique({ where: { id: acct.id } });
  expect(read!.accessToken).toBe('plain-token');
  await base.connectedAdAccount.delete({ where: { id: acct.id } });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `DATABASE_URL="postgresql://accelerate_user:accelerate_pass_local@localhost:5432/accelerate" pnpm --filter @workspace/database test`
Expected: FAIL ("Cannot find module './extension'").

- [ ] **Step 4: Implement the extension**

`packages/database/src/audit/extension.ts`:
```ts
import { Prisma, PrismaClient } from '@prisma/client';
import { getContext } from '@workspace/common/context';
import { encryptField, decryptField, isEncrypted } from '@workspace/common/crypto';
import { computeFieldDiff } from './diff';
import { AUDITED_MODELS, ENCRYPTED_FIELDS } from './config';

export class OptimisticLockError extends Error {
  constructor(model: string) {
    super(`Optimistic lock conflict updating ${model}`);
    this.name = 'OptimisticLockError';
  }
}

function encryptData(model: string, data: Record<string, any> | undefined) {
  if (!data) return;
  for (const f of ENCRYPTED_FIELDS[model] ?? []) {
    const v = data[f];
    if (typeof v === 'string' && !isEncrypted(v)) data[f] = encryptField(v);
    else if (v && typeof v === 'object') data[f] = encryptField(JSON.stringify(v));
  }
}

function decryptResult(model: string, row: any) {
  if (!row) return row;
  for (const f of ENCRYPTED_FIELDS[model] ?? []) {
    if (typeof row[f] === 'string' && isEncrypted(row[f])) row[f] = decryptField(row[f]);
  }
  return row;
}

export function withAuditAndEncryption(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (ENCRYPTED_FIELDS[model]) encryptData(model, args.data as any);
          const result = await query(args);
          if (AUDITED_MODELS[model]) {
            const ctx = getContext();
            const cfg = AUDITED_MODELS[model];
            const diff = computeFieldDiff({}, result as any, cfg.fields);
            await base.auditLog.create({
              data: {
                organizationId: ctx.orgId ?? (result as any).organizationId ?? null,
                actorId: ctx.actorId ?? null,
                actorType: ctx.actorType,
                entityType: model,
                entityId: (result as any).id,
                operation: 'CREATE',
                diff,
                toVersion: (result as any).version ?? 1,
                requestId: ctx.requestId ?? null,
              },
            });
          }
          return decryptResult(model, result);
        },

        async update({ model, args, query }) {
          if (ENCRYPTED_FIELDS[model]) encryptData(model, args.data as any);
          if (!AUDITED_MODELS[model]) return decryptResult(model, await query(args));

          return base.$transaction(async (tx) => {
            const before = await (tx as any)[model].findUnique({ where: (args as any).where });
            if (!before) throw new OptimisticLockError(model);
            const expected = (args as any).where?.version;
            if (expected !== undefined && before.version !== expected) {
              throw new OptimisticLockError(model);
            }
            const where = { ...(args as any).where };
            delete (where as any).version;
            const data = { ...(args as any).data, version: { increment: 1 } };
            const after = await (tx as any)[model].update({ where, data });
            const ctx = getContext();
            const diff = computeFieldDiff(before, after, AUDITED_MODELS[model].fields);
            if (Object.keys(diff).length > 0) {
              await tx.auditLog.create({
                data: {
                  organizationId: ctx.orgId ?? after.organizationId ?? null,
                  actorId: ctx.actorId ?? null,
                  actorType: ctx.actorType,
                  entityType: model,
                  entityId: after.id,
                  operation: 'UPDATE',
                  diff,
                  fromVersion: before.version,
                  toVersion: after.version,
                  requestId: ctx.requestId ?? null,
                },
              });
            }
            return decryptResult(model, after);
          });
        },

        async delete({ model, args, query }) {
          if (!AUDITED_MODELS[model]) return query(args);
          return base.$transaction(async (tx) => {
            const before = await (tx as any)[model].findUnique({ where: (args as any).where });
            const result = await (tx as any)[model].delete((args as any));
            if (before) {
              const ctx = getContext();
              const diff = computeFieldDiff(before, {}, AUDITED_MODELS[model].fields);
              await tx.auditLog.create({
                data: {
                  organizationId: ctx.orgId ?? before.organizationId ?? null,
                  actorId: ctx.actorId ?? null,
                  actorType: ctx.actorType,
                  entityType: model,
                  entityId: before.id,
                  operation: 'DELETE',
                  diff,
                  fromVersion: before.version,
                  requestId: ctx.requestId ?? null,
                },
              });
            }
            return result;
          });
        },

        async findUnique({ model, args, query }) {
          return decryptResult(model, await query(args));
        },
        async findFirst({ model, args, query }) {
          return decryptResult(model, await query(args));
        },
        async findMany({ model, args, query }) {
          const rows = await query(args);
          if (Array.isArray(rows) && ENCRYPTED_FIELDS[model]) rows.forEach((r) => decryptResult(model, r));
          return rows;
        },
      },
    },
  });
}
```
Note on `updateMany`/`deleteMany`: per the spec, these are **not** used on audited models. Do not route them through audit; if a future need arises, add a coarse-summary audit row. Leave them unextended.

- [ ] **Step 5: Wire the extension into the singleton**

Replace `packages/database/src/client.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { withAuditAndEncryption } from './audit/extension';

declare global {
  // eslint-disable-next-line no-var
  var prismaBase: PrismaClient | undefined;
}

const base = global.prismaBase || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.prismaBase = base;

export const prisma = withAuditAndEncryption(base);
export type ExtendedPrisma = typeof prisma;
```
Add to `packages/database/src/index.ts`:
```ts
export { OptimisticLockError } from './audit/extension';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `DATABASE_URL="postgresql://accelerate_user:accelerate_pass_local@localhost:5432/accelerate" pnpm --filter @workspace/database test`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**
```bash
git add packages/database/src/audit packages/database/src/client.ts packages/database/src/index.ts
git commit -m "feat(database): audit + optimistic-lock + field-encryption Prisma extension"
```

---

## Task 7 (A6): Backfill script for existing plaintext tokens

**Files:**
- Create: `packages/database/scripts/encrypt-existing-secrets.ts`
- Create: `packages/database/scripts/encrypt-existing-secrets.test.ts`
- Modify: `packages/database/package.json` (script entry)

**Interfaces:**
- Consumes: `encryptField`/`isEncrypted` (`@workspace/common/crypto`), base `PrismaClient` (unextended, to avoid double-encryption).
- Produces: `backfillEncryptedSecrets(base: PrismaClient): Promise<{ connectedAdAccounts: number; commerceConnectors: number }>` — idempotent.

- [ ] **Step 1: Write the failing test**

`packages/database/scripts/encrypt-existing-secrets.test.ts`:
```ts
import { test, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { isEncrypted } from '@workspace/common/crypto';
import { backfillEncryptedSecrets } from './encrypt-existing-secrets';

const base = new PrismaClient();
let orgId: string;
let acctId: string;

beforeAll(async () => {
  process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64);
  const org = await base.organization.create({ data: { name: 'bf-org', slug: `bf-${Date.now()}` } as any });
  orgId = org.id;
  // insert raw plaintext token, bypassing the extension
  const acct = await base.connectedAdAccount.create({
    data: { organizationId: orgId, platform: 'meta', accountId: 'a', accountName: 'n', accessToken: 'PLAINTEXT' },
  });
  acctId = acct.id;
});

afterAll(async () => {
  await base.connectedAdAccount.deleteMany({ where: { organizationId: orgId } });
  await base.organization.delete({ where: { id: orgId } });
  await base.$disconnect();
});

test('encrypts plaintext tokens and is idempotent', async () => {
  const first = await backfillEncryptedSecrets(base);
  expect(first.connectedAdAccounts).toBe(1);
  const raw = await base.$queryRawUnsafe<any[]>(`select "accessToken" from "ConnectedAdAccount" where id = $1`, acctId);
  expect(isEncrypted(raw[0].accessToken)).toBe(true);
  const second = await backfillEncryptedSecrets(base);
  expect(second.connectedAdAccounts).toBe(0); // nothing left to do
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="postgresql://accelerate_user:accelerate_pass_local@localhost:5432/accelerate" pnpm --filter @workspace/database test`
Expected: FAIL ("Cannot find module './encrypt-existing-secrets'").

- [ ] **Step 3: Implement (raw SQL to bypass the extension)**

`packages/database/scripts/encrypt-existing-secrets.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { encryptField, isEncrypted } from '@workspace/common/crypto';

export async function backfillEncryptedSecrets(base: PrismaClient) {
  let accounts = 0;
  const rows = await base.$queryRawUnsafe<any[]>(
    `select id, "accessToken", "refreshToken" from "ConnectedAdAccount"`,
  );
  for (const r of rows) {
    const updates: string[] = [];
    const params: any[] = [];
    if (typeof r.accessToken === 'string' && r.accessToken && !isEncrypted(r.accessToken)) {
      params.push(encryptField(r.accessToken)); updates.push(`"accessToken" = $${params.length}`);
    }
    if (typeof r.refreshToken === 'string' && r.refreshToken && !isEncrypted(r.refreshToken)) {
      params.push(encryptField(r.refreshToken)); updates.push(`"refreshToken" = $${params.length}`);
    }
    if (updates.length) {
      params.push(r.id);
      await base.$executeRawUnsafe(
        `update "ConnectedAdAccount" set ${updates.join(', ')} where id = $${params.length}`,
        ...params,
      );
      accounts++;
    }
  }

  let connectors = 0;
  const crows = await base.$queryRawUnsafe<any[]>(`select id, credentials from "CommerceConnector"`);
  for (const r of crows) {
    const cur = typeof r.credentials === 'string' ? r.credentials : JSON.stringify(r.credentials);
    if (cur && !isEncrypted(cur)) {
      await base.$executeRawUnsafe(
        `update "CommerceConnector" set credentials = $1 where id = $2`,
        encryptField(cur), r.id,
      );
      connectors++;
    }
  }
  return { connectedAdAccounts: accounts, commerceConnectors: connectors };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const base = new PrismaClient();
  backfillEncryptedSecrets(base)
    .then((r) => { console.log('Backfill complete:', r); return base.$disconnect(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
```
Note: `CommerceConnector.credentials` is JSON in the schema; storing an encrypted string in a `Json` column requires the column to accept a JSON string value. Confirm by reading `schema.prisma` — if `credentials Json`, store as a JSON string (`JSON.stringify(encryptField(...))` is **not** needed; Postgres `jsonb` accepts a bare quoted string). If this raises a type error at runtime, change the column to `String` in a follow-up migration and note it in the run-log.

- [ ] **Step 4: Add the script entry**

In `packages/database/package.json` `scripts`:
```json
"backfill:secrets": "dotenv -e ../../apps/dashboard/.env -- tsx scripts/encrypt-existing-secrets.ts"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `DATABASE_URL="postgresql://accelerate_user:accelerate_pass_local@localhost:5432/accelerate" pnpm --filter @workspace/database test`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add packages/database/scripts packages/database/package.json
git commit -m "feat(database): idempotent backfill to encrypt existing plaintext secrets"
```

---

## Task 8 (A7): Seed request context in services

**Files:**
- Modify: `services/accelerate-campaigns-service/src/auth.ts`
- Modify: `services/accelerate-campaigns-service/src/index.ts`
- Modify: `services/accelerate-campaigns-service/package.json` (add `@workspace/common` dep if absent)

**Interfaces:**
- Consumes: `runWithContext` (`@workspace/common/context`).
- Produces: every request handler in campaigns-service runs inside a `RequestContext` seeded from `X-User-Id` / `X-Org-Id` / `X-Request-Id` headers (actorType `agent` when called via internal key, else `user`).

- [ ] **Step 1: Add a Fastify hook that wraps handlers in context**

In `services/accelerate-campaigns-service/src/index.ts`, after the Fastify instance is created and before routes are registered, add:
```ts
import { runWithContext, type RequestContext } from '@workspace/common/context';

fastify.addHook('onRequest', (request, _reply, done) => {
  const ctx: RequestContext = {
    actorId: (request.headers['x-user-id'] as string) || undefined,
    orgId: (request.headers['x-org-id'] as string) || undefined,
    requestId: (request.headers['x-request-id'] as string) || undefined,
    actorType: request.headers['x-internal-api-key'] ? 'agent' : 'user',
  };
  runWithContext(ctx, () => done());
});
```
Note: `runWithContext` around `done()` keeps the ALS store active for the request lifecycle in Fastify's hook chain.

- [ ] **Step 2: Ensure the dependency is present**

In `services/accelerate-campaigns-service/package.json` `dependencies`, add if missing:
```json
"@workspace/common": "workspace:*"
```
Run: `pnpm install`

- [ ] **Step 3: Typecheck the service**

Run: `pnpm --filter @accelerate/campaigns-service exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add services/accelerate-campaigns-service/src/index.ts services/accelerate-campaigns-service/src/auth.ts services/accelerate-campaigns-service/package.json
git commit -m "feat(campaigns-service): seed request context from headers for audit actor"
```

---

# Phase B — Reconciliation Engine

## Task 9 (B1): Run-log schema (CampaignRun + CampaignRunItem)

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create (generated): migration

**Interfaces:**
- Produces: `CampaignRun` and `CampaignRunItem` models (see spec B6 for exact fields).

- [ ] **Step 1: Add the models**

Append to `packages/database/prisma/schema.prisma`:
```prisma
model CampaignRun {
  id             String            @id @default(uuid()) @db.Uuid
  campaignId     String            @db.Uuid
  organizationId String            @db.Uuid
  trigger        String            @db.VarChar(16) // publish | edit | retry
  status         String            @db.VarChar(16) // RUNNING | SUCCESS | PARTIAL | FAILED
  startedAt      DateTime          @default(now())
  finishedAt     DateTime?
  items          CampaignRunItem[]

  @@index([campaignId])
}

model CampaignRunItem {
  id           String      @id @default(uuid()) @db.Uuid
  runId        String      @db.Uuid
  platform     String      @db.VarChar(50)
  resourceType String      @db.VarChar(50)
  localId      String?     @db.Uuid
  externalId   String?     @db.VarChar(255)
  operation    String      @db.VarChar(16) // CREATE | UPDATE | DELETE | NOOP
  status       String      @db.VarChar(16) // SUCCESS | FAILED | ROLLED_BACK | NOOP
  error        String?     @db.Text
  durationMs   Int?
  run          CampaignRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId])
}
```

- [ ] **Step 2: Migrate**

Run: `pnpm --filter @workspace/database exec prisma migrate dev --name campaign_run_log`
Expected: applied + generated.

- [ ] **Step 3: Commit**
```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(database): CampaignRun + CampaignRunItem run-log models"
```

---

## Task 10 (B2): Engine types + resource graph builder

**Files:**
- Create: `services/accelerate-campaigns-service/src/reconcile/types.ts`
- Create: `services/accelerate-campaigns-service/src/reconcile/graph.ts`
- Create: `services/accelerate-campaigns-service/src/reconcile/graph.test.ts`

**Interfaces:**
- Produces:
  - `type ResourceType = 'budget' | 'campaign' | 'adgroup' | 'ad'`
  - `interface ResourceNode { type: ResourceType; localId: string; externalId?: string; desired: Record<string, unknown>; lastApplied?: Record<string, unknown> | null; deps: string[] }`
  - `type Platform = 'google' | 'meta' | 'bing'`
  - `buildPlatformGraph(input: PlatformGraphInput): ResourceNode[]` where `PlatformGraphInput` carries the desired platform plan + existing externalIds/lastApplied per node.

- [ ] **Step 1: Write types**

`services/accelerate-campaigns-service/src/reconcile/types.ts`:
```ts
export type Platform = 'google' | 'meta' | 'bing';
export type ResourceType = 'budget' | 'campaign' | 'adgroup' | 'ad';
export type Operation = 'CREATE' | 'UPDATE' | 'DELETE' | 'NOOP';

export interface ResourceNode {
  type: ResourceType;
  localId: string;
  externalId?: string;
  desired: Record<string, unknown>;
  lastApplied?: Record<string, unknown> | null;
  deps: string[]; // localIds this node depends on
}

export interface PlannedOp {
  node: ResourceNode;
  operation: Operation;
  changedFields: string[];
}
```

- [ ] **Step 2: Write the failing test**

`services/accelerate-campaigns-service/src/reconcile/graph.test.ts`:
```ts
import { test, expect } from 'vitest';
import { buildPlatformGraph } from './graph';

test('builds budget -> campaign -> adgroup -> ad with deps', () => {
  const nodes = buildPlatformGraph({
    platform: 'meta',
    campaignLocalId: 'c1',
    campaignDesired: { name: 'C', objective: 'SALES' },
    budget: { localId: 'b1', desired: { amount: 100 } },
    adGroups: [
      { localId: 'ag1', desired: { name: 'AG' }, ads: [{ localId: 'ad1', desired: { headlines: ['h'] } }] },
    ],
  });
  const byType = (t: string) => nodes.filter((n) => n.type === t);
  expect(byType('budget')).toHaveLength(1);
  expect(byType('campaign')[0].deps).toContain('b1');
  expect(byType('adgroup')[0].deps).toContain('c1');
  expect(byType('ad')[0].deps).toContain('ag1');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @accelerate/campaigns-service test`
Expected: FAIL ("Cannot find module './graph'").

- [ ] **Step 4: Implement**

`services/accelerate-campaigns-service/src/reconcile/graph.ts`:
```ts
import type { Platform, ResourceNode } from './types';

export interface GraphAdInput { localId: string; externalId?: string; desired: Record<string, unknown>; lastApplied?: Record<string, unknown> | null; }
export interface GraphAdGroupInput { localId: string; externalId?: string; desired: Record<string, unknown>; lastApplied?: Record<string, unknown> | null; ads: GraphAdInput[]; }
export interface PlatformGraphInput {
  platform: Platform;
  campaignLocalId: string;
  campaignExternalId?: string;
  campaignDesired: Record<string, unknown>;
  campaignLastApplied?: Record<string, unknown> | null;
  budget: { localId: string; externalId?: string; desired: Record<string, unknown>; lastApplied?: Record<string, unknown> | null };
  adGroups: GraphAdGroupInput[];
}

export function buildPlatformGraph(input: PlatformGraphInput): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  nodes.push({ type: 'budget', localId: input.budget.localId, externalId: input.budget.externalId, desired: input.budget.desired, lastApplied: input.budget.lastApplied ?? null, deps: [] });
  nodes.push({ type: 'campaign', localId: input.campaignLocalId, externalId: input.campaignExternalId, desired: input.campaignDesired, lastApplied: input.campaignLastApplied ?? null, deps: [input.budget.localId] });
  for (const ag of input.adGroups) {
    nodes.push({ type: 'adgroup', localId: ag.localId, externalId: ag.externalId, desired: ag.desired, lastApplied: ag.lastApplied ?? null, deps: [input.campaignLocalId] });
    for (const ad of ag.ads) {
      nodes.push({ type: 'ad', localId: ad.localId, externalId: ad.externalId, desired: ad.desired, lastApplied: ad.lastApplied ?? null, deps: [ag.localId] });
    }
  }
  return nodes;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @accelerate/campaigns-service test`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add services/accelerate-campaigns-service/src/reconcile/types.ts services/accelerate-campaigns-service/src/reconcile/graph.ts services/accelerate-campaigns-service/src/reconcile/graph.test.ts
git commit -m "feat(campaigns-service): reconcile resource-graph builder + types"
```

---

## Task 11 (B3): Diff function (2-way, 3-way-ready)

**Files:**
- Create: `services/accelerate-campaigns-service/src/reconcile/diff.ts`
- Create: `services/accelerate-campaigns-service/src/reconcile/diff.test.ts`

**Interfaces:**
- Consumes: `ResourceNode`, `Operation`, `PlannedOp` (B2 types).
- Produces: `diffNode(node: ResourceNode, live?: Record<string, unknown>): PlannedOp`.

- [ ] **Step 1: Write the failing test**

`services/accelerate-campaigns-service/src/reconcile/diff.test.ts`:
```ts
import { test, expect } from 'vitest';
import { diffNode } from './diff';
import type { ResourceNode } from './types';

const base = (over: Partial<ResourceNode>): ResourceNode => ({ type: 'campaign', localId: 'c', desired: {}, deps: [], ...over });

test('CREATE when no lastApplied and no externalId', () => {
  expect(diffNode(base({ desired: { name: 'A' } })).operation).toBe('CREATE');
});
test('NOOP when desired equals lastApplied', () => {
  expect(diffNode(base({ externalId: 'x', desired: { name: 'A' }, lastApplied: { name: 'A' } })).operation).toBe('NOOP');
});
test('UPDATE with changed fields', () => {
  const op = diffNode(base({ externalId: 'x', desired: { name: 'B', budget: 5 }, lastApplied: { name: 'A', budget: 5 } }));
  expect(op.operation).toBe('UPDATE');
  expect(op.changedFields).toEqual(['name']);
});
test('DELETE when desired empty but lastApplied present', () => {
  expect(diffNode(base({ externalId: 'x', desired: {}, lastApplied: { name: 'A' } })).operation).toBe('DELETE');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @accelerate/campaigns-service test`
Expected: FAIL ("Cannot find module './diff'").

- [ ] **Step 3: Implement**

`services/accelerate-campaigns-service/src/reconcile/diff.ts`:
```ts
import type { ResourceNode, PlannedOp } from './types';

function changedFields(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k);
  return out.sort();
}

const isEmpty = (o?: Record<string, unknown> | null) => !o || Object.keys(o).length === 0;

export function diffNode(node: ResourceNode, _live?: Record<string, unknown>): PlannedOp {
  // _live reserved for 3-way; 2-way uses lastApplied only.
  const last = node.lastApplied;
  if (isEmpty(last) && !node.externalId) {
    return { node, operation: 'CREATE', changedFields: Object.keys(node.desired) };
  }
  if (isEmpty(node.desired) && !isEmpty(last)) {
    return { node, operation: 'DELETE', changedFields: [] };
  }
  const fields = changedFields(node.desired, last ?? {});
  return { node, operation: fields.length ? 'UPDATE' : 'NOOP', changedFields: fields };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @accelerate/campaigns-service test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add services/accelerate-campaigns-service/src/reconcile/diff.ts services/accelerate-campaigns-service/src/reconcile/diff.test.ts
git commit -m "feat(campaigns-service): 2-way diff (3-way-ready) for resource nodes"
```

---

## Task 12 (B4): Planner (topological sort)

**Files:**
- Create: `services/accelerate-campaigns-service/src/reconcile/planner.ts`
- Create: `services/accelerate-campaigns-service/src/reconcile/planner.test.ts`

**Interfaces:**
- Consumes: `ResourceNode` (B2).
- Produces: `topoSort(nodes: ResourceNode[]): ResourceNode[]` (deps-before-dependents); throws `Error('cycle detected')` on a cycle.

- [ ] **Step 1: Write the failing test**

`services/accelerate-campaigns-service/src/reconcile/planner.test.ts`:
```ts
import { test, expect } from 'vitest';
import { topoSort } from './planner';
import type { ResourceNode } from './types';

const n = (localId: string, deps: string[]): ResourceNode => ({ type: 'campaign', localId, desired: {}, deps });

test('orders dependencies before dependents', () => {
  const out = topoSort([n('ad', ['ag']), n('ag', ['c']), n('c', ['b']), n('b', [])]).map((x) => x.localId);
  expect(out.indexOf('b')).toBeLessThan(out.indexOf('c'));
  expect(out.indexOf('c')).toBeLessThan(out.indexOf('ag'));
  expect(out.indexOf('ag')).toBeLessThan(out.indexOf('ad'));
});

test('throws on cycle', () => {
  expect(() => topoSort([n('a', ['b']), n('b', ['a'])])).toThrow('cycle detected');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @accelerate/campaigns-service test`
Expected: FAIL ("Cannot find module './planner'").

- [ ] **Step 3: Implement Kahn's algorithm**

`services/accelerate-campaigns-service/src/reconcile/planner.ts`:
```ts
import type { ResourceNode } from './types';

export function topoSort(nodes: ResourceNode[]): ResourceNode[] {
  const byId = new Map(nodes.map((n) => [n.localId, n]));
  const indeg = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const node of nodes) indeg.set(node.localId, 0);
  for (const node of nodes) {
    for (const dep of node.deps) {
      if (!byId.has(dep)) continue;
      indeg.set(node.localId, (indeg.get(node.localId) ?? 0) + 1);
      dependents.set(dep, [...(dependents.get(dep) ?? []), node.localId]);
    }
  }
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const out: ResourceNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(byId.get(id)!);
    for (const d of dependents.get(id) ?? []) {
      indeg.set(d, (indeg.get(d) ?? 0) - 1);
      if (indeg.get(d) === 0) queue.push(d);
    }
  }
  if (out.length !== nodes.length) throw new Error('cycle detected');
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @accelerate/campaigns-service test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add services/accelerate-campaigns-service/src/reconcile/planner.ts services/accelerate-campaigns-service/src/reconcile/planner.test.ts
git commit -m "feat(campaigns-service): topological planner for reconcile graph"
```

---

## Task 13 (B5): Platform adapter interface + adapters (refactor from publish.ts)

**Files:**
- Create: `services/accelerate-campaigns-service/src/reconcile/adapters/types.ts`
- Create: `services/accelerate-campaigns-service/src/reconcile/adapters/meta.ts`
- Create: `services/accelerate-campaigns-service/src/reconcile/adapters/google.ts`
- Create: `services/accelerate-campaigns-service/src/reconcile/adapters/bing.ts`
- Source to extract from: `services/accelerate-campaigns-service/src/routes/publish.ts:80-365`

**Interfaces:**
- Produces:
  - `interface PlatformAdapter { create(node, ctx): Promise<{ externalId: string }>; update(node, externalId, changedFields, ctx): Promise<void>; delete(externalId, ctx): Promise<void>; fetchLive?(externalId, ctx): Promise<Record<string, unknown>> }`
  - `interface AdapterCtx { account: ConnectedAccount; mediaPlan: MediaPlan }` (reuse the `ConnectedAccount`/`MediaPlan` types currently inline in `publish.ts` — move them to `adapters/types.ts`).
  - `metaAdapter`, `googleAdapter`, `bingAdapter` instances.

- [ ] **Step 1: Move shared types + define the interface**

Create `services/accelerate-campaigns-service/src/reconcile/adapters/types.ts` and move the `AdCreative`, `AdTypePlan`, `PlatformPlan`, `MediaPlan`, `ConnectedAccount` type aliases out of `publish.ts` into it (export them). Add:
```ts
import type { ResourceNode } from '../types';

export interface AdapterCtx { account: ConnectedAccount; mediaPlan: MediaPlan }

export interface PlatformAdapter {
  /** When true, create() on the campaign node builds the whole platform tree;
   *  the executor skips create() for child adgroup/ad nodes this phase. */
  treeCreate?: boolean;
  create(node: ResourceNode, ctx: AdapterCtx): Promise<{ externalId: string }>;
  update(node: ResourceNode, externalId: string, changedFields: string[], ctx: AdapterCtx): Promise<void>;
  delete(externalId: string, ctx: AdapterCtx): Promise<void>;
  fetchLive?(externalId: string, ctx: AdapterCtx): Promise<Record<string, unknown>>;
}
```

- [ ] **Step 2: Build the Meta adapter from existing code**

Create `adapters/meta.ts`. Move the Meta helpers (`metaPost`, `OBJECTIVE_MAP`, `metaObjective`, `metaOptimizationGoal`, `metaBillingEvent`, `metaGeoSpec`, `parseAgeRange`, and the body of `createMetaCampaign`) from `publish.ts:80-242` into it. Wrap them behind:
```ts
export const metaAdapter: PlatformAdapter = {
  async create(node, ctx) {
    // For type 'campaign': call the extracted createMetaCampaign(...) and return its id.
    // (ad groups/ads are created within createMetaCampaign today; keep that behavior for
    //  'campaign' nodes and return NOOP-style success for 'adgroup'/'ad' nodes whose work
    //  the campaign create already performed — see note.)
    const externalId = await createMetaCampaign(ctx.account.accountId, ctx.account.accessToken, ctx.mediaPlan, ctx.account.facebookPageId);
    return { externalId };
  },
  async update(node, externalId, changedFields, ctx) {
    // Initial coverage: status + daily_budget via metaPost(`${externalId}`, {...}).
    if (changedFields.includes('status')) {
      await metaPost(externalId, { status: (node.desired as any).status }, ctx.account.accessToken);
    }
    if (changedFields.includes('budget')) {
      await metaPost(externalId, { daily_budget: Math.round(Number((node.desired as any).budget) * 100) }, ctx.account.accessToken);
    }
  },
  async delete(externalId, ctx) {
    await metaPost(externalId, { status: 'DELETED' }, ctx.account.accessToken);
  },
};
```
**Note on granularity:** today `createMetaCampaign` creates the whole tree in one call. For this phase keep that: the executor (B6) treats the `campaign` node's adapter call as creating the platform tree, and marks `adgroup`/`ad` nodes as `NOOP` (their work is folded into campaign create). The graph still records them for the run log and future per-resource adapters. Encode this by having `metaAdapter.create` only act for `node.type === 'campaign'` and the executor skip create calls for child nodes when the platform adapter declares `treeCreate = true`. Add `treeCreate?: boolean` to `PlatformAdapter` and set it `true` for all three adapters in this phase.

- [ ] **Step 3: Build Google + Bing adapters the same way**

Create `adapters/google.ts` (move `googlePost`, `GOOGLE_CHANNEL_MAP`, `COUNTRY_CRITERION_IDS`, `createGoogleCampaign` from `publish.ts:248-316`) and `adapters/bing.ts` (move `bingPost`, `BING_OBJECTIVE_MAP`, `createBingCampaign` from `publish.ts:322-365`), each exporting an adapter with `treeCreate = true`, a `create` that calls the moved function, an `update` covering status/budget where the platform API supports it (Google: `campaigns:mutate` updateMask; Bing: `Campaigns/UpdateCampaigns`), and a `delete` that pauses/removes. For update/delete bodies that the existing code does not yet contain, implement the minimal documented call:
  - Google update status: `googlePost('customers/<cid>/campaigns:mutate', { operations: [{ update: { resourceName: externalId, status }, updateMask: 'status' }] }, token, devToken)`.
  - Bing update status: `bingPost('Campaigns/UpdateCampaigns', { AccountId, Campaigns: [{ Id: externalId, Status: status }] }, token, devToken, customerId, accountId)`.
  - delete: Google set `status: 'REMOVED'`; Bing `Campaigns/DeleteCampaigns`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @accelerate/campaigns-service exec tsc --noEmit`
Expected: no errors (publish.ts still imports the moved helpers from adapters — fix imports until clean).

- [ ] **Step 5: Commit**
```bash
git add services/accelerate-campaigns-service/src/reconcile/adapters
git commit -m "feat(campaigns-service): platform adapter interface + meta/google/bing adapters"
```

---

## Task 14 (B6): Executor (per-platform isolation + rollback + run log)

**Files:**
- Create: `services/accelerate-campaigns-service/src/reconcile/executor.ts`
- Create: `services/accelerate-campaigns-service/src/reconcile/executor.test.ts`

**Interfaces:**
- Consumes: `topoSort` (B4), `diffNode` (B3), `PlatformAdapter` (B5), `prisma` (`@workspace/database`).
- Produces: `reconcilePlatform(args: ReconcilePlatformArgs): Promise<PlatformOutcome>` and `runReconcile(args: RunReconcileArgs): Promise<RunSummary>` where:
  - `ReconcilePlatformArgs = { platform: Platform; nodes: ResourceNode[]; adapter: PlatformAdapter; ctx: AdapterCtx; runId: string; recordItem: (item: RunItem) => Promise<void> }`
  - `PlatformOutcome = { platform: Platform; success: boolean; externalId?: string; error?: string }`
  - `RunReconcileArgs = { campaignId: string; organizationId: string; trigger: 'publish'|'edit'|'retry'; platforms: { platform: Platform; nodes: ResourceNode[]; adapter: PlatformAdapter; ctx: AdapterCtx }[] }`
  - `RunSummary = { runId: string; status: 'SUCCESS'|'PARTIAL'|'FAILED'; platformResults: PlatformOutcome[] }`

- [ ] **Step 1: Write the failing test (mock adapters)**

`services/accelerate-campaigns-service/src/reconcile/executor.test.ts`:
```ts
import { test, expect, vi } from 'vitest';
import { reconcilePlatform } from './executor';
import type { PlatformAdapter } from './adapters/types';
import type { ResourceNode } from './types';

const okAdapter = (): PlatformAdapter => ({
  treeCreate: true,
  create: vi.fn(async () => ({ externalId: 'ext-1' })),
  update: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
});

const nodes: ResourceNode[] = [
  { type: 'budget', localId: 'b', desired: { amount: 1 }, deps: [] },
  { type: 'campaign', localId: 'c', desired: { name: 'C' }, deps: ['b'] },
];

test('clean create returns success + externalId, records items', async () => {
  const items: any[] = [];
  const out = await reconcilePlatform({
    platform: 'meta', nodes, adapter: okAdapter(),
    ctx: {} as any, runId: 'r1', recordItem: async (i) => { items.push(i); },
  });
  expect(out.success).toBe(true);
  expect(out.externalId).toBe('ext-1');
  expect(items.some((i) => i.status === 'SUCCESS')).toBe(true);
});

test('failure on create rolls back created resources (best-effort) and records', async () => {
  const del = vi.fn(async () => {});
  const adapter: PlatformAdapter = {
    treeCreate: true,
    create: vi.fn(async () => { throw new Error('meta 400'); }),
    update: vi.fn(async () => {}),
    delete: del,
  };
  const items: any[] = [];
  const out = await reconcilePlatform({
    platform: 'meta', nodes, adapter, ctx: {} as any, runId: 'r1',
    recordItem: async (i) => { items.push(i); },
  });
  expect(out.success).toBe(false);
  expect(out.error).toContain('meta 400');
  expect(items.some((i) => i.status === 'FAILED')).toBe(true);
});
```
Note: the test injects a `recordItem` callback so the executor's run-log writes are observable without a DB. The real route passes a `recordItem` that writes `CampaignRunItem` rows.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @accelerate/campaigns-service test`
Expected: FAIL ("Cannot find module './executor'").

- [ ] **Step 3: Implement**

`services/accelerate-campaigns-service/src/reconcile/executor.ts`:
```ts
import { topoSort } from './planner';
import { diffNode } from './diff';
import type { ResourceNode, Platform } from './types';
import type { PlatformAdapter, AdapterCtx } from './adapters/types';

export interface RunItem {
  platform: Platform; resourceType: string; localId?: string; externalId?: string;
  operation: string; status: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK' | 'NOOP'; error?: string; durationMs?: number;
}
export interface PlatformOutcome { platform: Platform; success: boolean; externalId?: string; error?: string }

export interface ReconcilePlatformArgs {
  platform: Platform; nodes: ResourceNode[]; adapter: PlatformAdapter; ctx: AdapterCtx; runId: string;
  recordItem: (item: RunItem) => Promise<void>;
}

export async function reconcilePlatform(args: ReconcilePlatformArgs): Promise<PlatformOutcome> {
  const { platform, adapter, ctx, recordItem } = args;
  const ordered = topoSort(args.nodes);
  const created: { externalId: string }[] = [];
  let campaignExternalId: string | undefined;

  try {
    for (const node of ordered) {
      const plan = diffNode(node);
      const isChild = node.type === 'adgroup' || node.type === 'ad';
      // Tree-create platforms build children inside the campaign create call.
      if (adapter.treeCreate && isChild && plan.operation === 'CREATE') {
        await recordItem({ platform, resourceType: node.type, localId: node.localId, operation: 'NOOP', status: 'NOOP' });
        continue;
      }
      const started = Date.now();
      if (plan.operation === 'NOOP') {
        await recordItem({ platform, resourceType: node.type, localId: node.localId, externalId: node.externalId, operation: 'NOOP', status: 'NOOP' });
        continue;
      }
      if (plan.operation === 'CREATE') {
        const { externalId } = await adapter.create(node, ctx);
        created.push({ externalId });
        if (node.type === 'campaign') campaignExternalId = externalId;
        await recordItem({ platform, resourceType: node.type, localId: node.localId, externalId, operation: 'CREATE', status: 'SUCCESS', durationMs: Date.now() - started });
      } else if (plan.operation === 'UPDATE') {
        await adapter.update(node, node.externalId!, plan.changedFields, ctx);
        await recordItem({ platform, resourceType: node.type, localId: node.localId, externalId: node.externalId, operation: 'UPDATE', status: 'SUCCESS', durationMs: Date.now() - started });
      } else if (plan.operation === 'DELETE') {
        await adapter.delete(node.externalId!, ctx);
        await recordItem({ platform, resourceType: node.type, localId: node.localId, externalId: node.externalId, operation: 'DELETE', status: 'SUCCESS', durationMs: Date.now() - started });
      }
    }
    return { platform, success: true, externalId: campaignExternalId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordItem({ platform, resourceType: 'campaign', operation: 'CREATE', status: 'FAILED', error: message });
    // best-effort rollback in reverse creation order
    for (const c of created.reverse()) {
      try { await adapter.delete(c.externalId, ctx); await recordItem({ platform, resourceType: 'campaign', externalId: c.externalId, operation: 'DELETE', status: 'ROLLED_BACK' }); }
      catch (rbErr) { console.error(`[reconcile] rollback failed for ${c.externalId}:`, rbErr); }
    }
    return { platform, success: false, error: message };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @accelerate/campaigns-service test`
Expected: PASS (2 tests).

- [ ] **Step 5: Add `runReconcile` orchestrator (parallel platforms + run-log + state persist)**

Append to `executor.ts`:
```ts
import { prisma } from '@workspace/database';

export interface RunReconcileArgs {
  campaignId: string; organizationId: string; trigger: 'publish' | 'edit' | 'retry';
  platforms: { platform: Platform; nodes: ResourceNode[]; adapter: PlatformAdapter; ctx: AdapterCtx }[];
}
export interface RunSummary { runId: string; status: 'SUCCESS' | 'PARTIAL' | 'FAILED'; platformResults: PlatformOutcome[] }

export async function runReconcile(args: RunReconcileArgs): Promise<RunSummary> {
  const run = await prisma.campaignRun.create({
    data: { campaignId: args.campaignId, organizationId: args.organizationId, trigger: args.trigger, status: 'RUNNING' },
  });
  const recordItem = (item: RunItem) => prisma.campaignRunItem.create({ data: { runId: run.id, ...item } }).then(() => {});
  const results = await Promise.all(
    args.platforms.map((p) => reconcilePlatform({ ...p, runId: run.id, recordItem })),
  );
  const ok = results.filter((r) => r.success).length;
  const status = ok === results.length ? 'SUCCESS' : ok === 0 ? 'FAILED' : 'PARTIAL';
  await prisma.campaignRun.update({ where: { id: run.id }, data: { status, finishedAt: new Date() } });
  return { runId: run.id, status, platformResults: results };
}
```
Persisting `externalId`/`lastAppliedState`/`version` onto `PlatformCampaign` happens in the route (Task B7), which owns the desired-state rows; the executor returns the `externalId` per platform for the route to store via the audited `prisma` client.

- [ ] **Step 6: Typecheck + re-run tests**

Run: `pnpm --filter @accelerate/campaigns-service exec tsc --noEmit && pnpm --filter @accelerate/campaigns-service test`
Expected: clean + PASS.

- [ ] **Step 7: Commit**
```bash
git add services/accelerate-campaigns-service/src/reconcile/executor.ts services/accelerate-campaigns-service/src/reconcile/executor.test.ts
git commit -m "feat(campaigns-service): reconcile executor with per-platform rollback + run log"
```

---

## Task 15 (B7): Rewrite publish route + add edit route

**Files:**
- Modify: `services/accelerate-campaigns-service/src/routes/publish.ts`
- Create: `services/accelerate-campaigns-service/src/routes/apply.ts`
- Modify: `services/accelerate-campaigns-service/src/index.ts` (register `apply` route)

**Interfaces:**
- Consumes: `runReconcile` (B6), `buildPlatformGraph` (B2), adapters (B5), `prisma` (`@workspace/database`).
- Produces:
  - `POST /campaigns/publish` returns `{ success, campaign_id, run_id, platform_results }`.
  - `POST /campaigns/:id/apply` re-runs reconcile after a desired-state edit.

- [ ] **Step 1: Rewrite the publish handler to use the engine**

In `publish.ts`, replace the inline per-platform create loop (`publish.ts:398-450`) with:
1. Fix the `Campaign` create to use the real schema fields:
```ts
const campaign = await prisma.campaign.create({
  data: {
    organizationId: org_id,
    createdBy: user_id,
    name: media_plan.campaignName,
    objective: media_plan.objective,
    status: 'DRAFT',
    totalBudget: media_plan.totalBudget ?? 0,
    currency: media_plan.currency ?? 'USD',
    startDate: media_plan.startDate ? new Date(media_plan.startDate) : null,
    endDate: media_plan.endDate ? new Date(media_plan.endDate) : null,
  },
});
```
2. For each platform in `media_plan.platforms` with a matching connected account, persist desired `PlatformCampaign`/`AdGroup`/`Ad` rows (status `draft`), build the graph via `buildPlatformGraph`, and choose the adapter:
```ts
const adapters = { meta: metaAdapter, google: googleAdapter, bing: bingAdapter };
const platforms = [];
for (const pp of media_plan.platforms) {
  const account = connected_accounts.find((a) => a.platform === pp.platform);
  if (!account?.accessToken) continue;
  const pc = await prisma.platformCampaign.create({ data: { campaignId: campaign.id, platform: pp.platform, adTypes: pp.adTypes.map((t) => t.adType), budget: pp.budget, status: 'draft' } });
  const nodes = buildPlatformGraph({
    platform: pp.platform,
    campaignLocalId: pc.id,
    campaignDesired: { name: media_plan.campaignName, objective: media_plan.objective },
    budget: { localId: `${pc.id}-budget`, desired: { amount: pp.budget } },
    adGroups: pp.adTypes.map((t, i) => ({ localId: `${pc.id}-ag${i}`, desired: { name: t.adType }, ads: [] })),
  });
  platforms.push({ platform: pp.platform, nodes, adapter: adapters[pp.platform], ctx: { account, mediaPlan: media_plan } });
}
```
3. Run the engine and persist external ids + lastAppliedState:
```ts
const summary = await runReconcile({ campaignId: campaign.id, organizationId: org_id, trigger: 'publish', platforms });
for (const r of summary.platformResults) {
  if (r.success && r.externalId) {
    await prisma.platformCampaign.updateMany({
      where: { campaignId: campaign.id, platform: r.platform },
      data: { platformCampaignId: r.externalId, status: 'paused', lastAppliedState: { name: media_plan.campaignName, budget: media_plan.totalBudget } },
    });
  }
}
if (summary.status !== 'FAILED') await prisma.campaign.update({ where: { id: campaign.id, version: campaign.version }, data: { status: 'PAUSED' } });
```
Note: `updateMany` on `PlatformCampaign` here is a deliberate non-audited bulk path keyed by platform; acceptable because the spec excludes bulk-op auditing. (If single-row audit is desired, switch to `update` by `pc.id`.)
4. Keep the existing notification block unchanged; map its `platformResults` from `summary.platformResults`.
5. Return:
```ts
return reply.send({ success: summary.status !== 'FAILED', campaign_id: campaign.id, run_id: summary.runId, platform_results: summary.platformResults });
```

- [ ] **Step 2: Add the edit/apply route**

`services/accelerate-campaigns-service/src/routes/apply.ts`:
```ts
import { FastifyInstance } from 'fastify';
import { prisma } from '@workspace/database';
import { verifyInternalKey } from '../auth';
import { buildPlatformGraph } from '../reconcile/graph';
import { runReconcile } from '../reconcile/executor';
import { metaAdapter } from '../reconcile/adapters/meta';
import { googleAdapter } from '../reconcile/adapters/google';
import { bingAdapter } from '../reconcile/adapters/bing';
import type { ConnectedAccount, MediaPlan } from '../reconcile/adapters/types';

const adapters = { meta: metaAdapter, google: googleAdapter, bing: bingAdapter } as const;

export async function applyRoute(fastify: FastifyInstance) {
  fastify.post('/campaigns/:id/apply', { preHandler: verifyInternalKey }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { connected_accounts, media_plan } = request.body as { connected_accounts: ConnectedAccount[]; media_plan: MediaPlan };

    const campaign = await prisma.campaign.findUnique({ where: { id }, include: { platformCampaigns: true } });
    if (!campaign) return reply.status(404).send({ error: 'campaign not found' });

    const platforms = [];
    for (const pc of campaign.platformCampaigns) {
      const account = connected_accounts.find((a) => a.platform === pc.platform);
      if (!account?.accessToken) continue;
      const nodes = buildPlatformGraph({
        platform: pc.platform as any,
        campaignLocalId: pc.id,
        campaignExternalId: pc.platformCampaignId ?? undefined,
        campaignDesired: { name: campaign.name, objective: campaign.objective },
        campaignLastApplied: (pc.lastAppliedState as any) ?? null,
        budget: { localId: `${pc.id}-budget`, desired: { amount: Number(pc.budget) } },
        adGroups: [],
      });
      platforms.push({ platform: pc.platform as any, nodes, adapter: adapters[pc.platform as 'meta' | 'google' | 'bing'], ctx: { account, mediaPlan: media_plan } });
    }

    const summary = await runReconcile({ campaignId: campaign.id, organizationId: campaign.organizationId, trigger: 'edit', platforms });
    return reply.send({ success: summary.status !== 'FAILED', campaign_id: campaign.id, run_id: summary.runId, platform_results: summary.platformResults });
  });
}
```
Register it in `index.ts`: `fastify.register(applyRoute);`

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @accelerate/campaigns-service exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke (no platform calls) — run the service**

Run: `pnpm --filter @accelerate/campaigns-service dev` (in a background shell), then:
```bash
curl -s -XPOST localhost:<port>/campaigns/publish -H 'content-type: application/json' \
  -d '{"org_id":"<real-org-uuid>","user_id":"<real-user-uuid>","connected_accounts":[],"media_plan":{"campaignName":"smoke","objective":"SALES","totalBudget":100,"currency":"USD","platforms":[]}}'
```
Expected: `{"success":...,"campaign_id":"...","run_id":"...","platform_results":[]}` (no platforms → empty results, a `CampaignRun` row written). Verify with `psql` that a `CampaignRun` exists.

- [ ] **Step 5: Commit**
```bash
git add services/accelerate-campaigns-service/src/routes/publish.ts services/accelerate-campaigns-service/src/routes/apply.ts services/accelerate-campaigns-service/src/index.ts
git commit -m "feat(campaigns-service): reconcile-engine publish + edit/apply routes"
```

---

## Task 16 (B8): Integration test — engine end-to-end with mocked adapters

**Files:**
- Create: `services/accelerate-campaigns-service/src/reconcile/integration.test.ts`

**Interfaces:**
- Consumes: `runReconcile` with mock adapters; the local DB for `CampaignRun`/`CampaignRunItem`.

- [ ] **Step 1: Write the test**

`services/accelerate-campaigns-service/src/reconcile/integration.test.ts`:
```ts
import { test, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '@workspace/database';
import { runReconcile } from './executor';
import { buildPlatformGraph } from './graph';
import type { PlatformAdapter } from './adapters/types';

let campaignId: string; let orgId: string;

beforeAll(async () => {
  const org = await (prisma as any).organization.create({ data: { name: 'recon-int', slug: `recon-${Date.now()}` } });
  orgId = org.id;
  const c = await prisma.campaign.create({ data: { organizationId: orgId, createdBy: orgId, name: 'INT', objective: 'SALES' } });
  campaignId = c.id;
});
afterAll(async () => {
  await prisma.campaignRun.deleteMany({ where: { campaignId } });
  await prisma.campaign.deleteMany({ where: { organizationId: orgId } });
  await (prisma as any).organization.delete({ where: { id: orgId } });
});

const adapter = (fail = false): PlatformAdapter => ({
  treeCreate: true,
  create: vi.fn(async () => { if (fail) throw new Error('boom'); return { externalId: 'EXT' }; }),
  update: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
});

test('partial failure -> PARTIAL status + per-platform items recorded', async () => {
  const nodes = buildPlatformGraph({ platform: 'meta', campaignLocalId: 'c', campaignDesired: { name: 'X' }, budget: { localId: 'b', desired: { amount: 1 } }, adGroups: [] });
  const summary = await runReconcile({
    campaignId, organizationId: orgId, trigger: 'publish',
    platforms: [
      { platform: 'meta', nodes, adapter: adapter(false), ctx: {} as any },
      { platform: 'google', nodes, adapter: adapter(true), ctx: {} as any },
    ],
  });
  expect(summary.status).toBe('PARTIAL');
  const items = await prisma.campaignRunItem.findMany({ where: { runId: summary.runId } });
  expect(items.some((i) => i.status === 'SUCCESS')).toBe(true);
  expect(items.some((i) => i.status === 'FAILED')).toBe(true);
});
```

- [ ] **Step 2: Run**

Run: `DATABASE_URL="postgresql://accelerate_user:accelerate_pass_local@localhost:5432/accelerate" pnpm --filter @accelerate/campaigns-service test`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add services/accelerate-campaigns-service/src/reconcile/integration.test.ts
git commit -m "test(campaigns-service): reconcile engine integration (partial failure + run log)"
```

---

## Final verification

- [ ] **Run all touched test suites**
```bash
DATABASE_URL="postgresql://accelerate_user:accelerate_pass_local@localhost:5432/accelerate" \
  pnpm --filter @workspace/common --filter @workspace/database --filter @accelerate/campaigns-service test
```
Expected: all PASS.

- [ ] **Typecheck the monorepo paths touched**
```bash
pnpm --filter @workspace/common --filter @workspace/database --filter @accelerate/campaigns-service exec tsc --noEmit
```

- [ ] **Provision `FIELD_ENCRYPTION_KEY`** in `apps/dashboard/.env`, every Fastify service `.env`, and CI: a 32-byte key, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

- [ ] **Run the secrets backfill once** (after key is set):
```bash
pnpm --filter @workspace/database backfill:secrets
```

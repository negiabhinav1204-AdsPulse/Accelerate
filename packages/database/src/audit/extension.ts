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
  for (const [f, type] of Object.entries(ENCRYPTED_FIELDS[model] ?? {})) {
    const v = data[f];
    if (type === 'json') {
      if (v !== undefined && v !== null) data[f] = encryptField(JSON.stringify(v));
    } else {
      if (typeof v === 'string' && !isEncrypted(v)) data[f] = encryptField(v);
    }
  }
}

function decryptResult(model: string, row: any) {
  if (!row) return row;
  for (const [f, type] of Object.entries(ENCRYPTED_FIELDS[model] ?? {})) {
    if (typeof row[f] === 'string' && isEncrypted(row[f])) {
      const plain = decryptField(row[f]);
      row[f] = type === 'json' ? JSON.parse(plain) : plain;
    }
  }
  return row;
}

const SENTINEL_ID = '00000000-0000-0000-0000-000000000000';

export function withAuditAndEncryption(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (ENCRYPTED_FIELDS[model]) encryptData(model, args.data as any);
          if (!AUDITED_MODELS[model]) return decryptResult(model, await query(args));
          return base.$transaction(async (tx) => {
            const created = await (tx as any)[model].create(args);
            const ctx = getContext();
            const diff = computeFieldDiff({}, created, AUDITED_MODELS[model].fields);
            await tx.auditLog.create({
              data: {
                organizationId: ctx.orgId ?? created.organizationId ?? null,
                actorId: ctx.actorId ?? null,
                actorType: ctx.actorType,
                entityType: model,
                entityId: created.id,
                operation: 'CREATE',
                diff: diff as Prisma.InputJsonValue,
                toVersion: created.version ?? 1,
                requestId: ctx.requestId ?? null,
              },
            });
            return decryptResult(model, created);
          });
        },

        async update({ model, args, query }) {
          if (ENCRYPTED_FIELDS[model]) encryptData(model, args.data as any);
          if (!AUDITED_MODELS[model]) return decryptResult(model, await query(args));

          return base.$transaction(async (tx) => {
            const lookupWhere = { ...(args as any).where };
            const expected = lookupWhere.version;
            delete lookupWhere.version;
            const before = await (tx as any)[model].findUnique({ where: lookupWhere });
            if (!before) {
              const e: any = new Error(`Record to update not found for ${model}`);
              e.code = 'P2025';
              throw e;
            }
            // Defensive early check (fast path before hitting DB again)
            if (expected !== undefined && before.version !== expected) {
              throw new OptimisticLockError(model);
            }
            const data = { ...(args as any).data, version: { increment: 1 } };
            // Atomic: include version in WHERE so concurrent updates race on the same predicate
            const atomicWhere = expected !== undefined
              ? { ...lookupWhere, version: expected }
              : lookupWhere;
            let after: any;
            try {
              after = await (tx as any)[model].update({ where: atomicWhere, data });
            } catch (err: any) {
              if (err?.code === 'P2025') throw new OptimisticLockError(model);
              throw err;
            }
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
                  diff: diff as Prisma.InputJsonValue,
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
            const result = await (tx as any)[model].delete(args as any);
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
                  diff: diff as Prisma.InputJsonValue,
                  fromVersion: before.version,
                  requestId: ctx.requestId ?? null,
                },
              });
            }
            return result;
          });
        },

        async updateMany({ model, args, query }) {
          if (!AUDITED_MODELS[model]) return query(args);
          // Inject version bump into data
          const data = { ...(args as any).data, version: { increment: 1 } };
          const result = await (base as any)[model].updateMany({ ...args, data });
          const ctx = getContext();
          // Strip the injected version increment from the logged diff payload
          const { version: _v, ...loggedData } = data;
          await base.auditLog.create({
            data: {
              organizationId: ctx.orgId ?? null,
              actorId: ctx.actorId ?? null,
              actorType: ctx.actorType,
              entityType: model,
              entityId: SENTINEL_ID,
              operation: 'UPDATE_MANY',
              diff: {
                where: (args as any).where ?? {},
                data: loggedData,
                count: result.count,
              } as Prisma.InputJsonValue,
              requestId: ctx.requestId ?? null,
            },
          });
          return result;
        },

        async deleteMany({ model, args, query }) {
          if (!AUDITED_MODELS[model]) return query(args);
          const result = await query(args);
          const ctx = getContext();
          await base.auditLog.create({
            data: {
              organizationId: ctx.orgId ?? null,
              actorId: ctx.actorId ?? null,
              actorType: ctx.actorType,
              entityType: model,
              entityId: SENTINEL_ID,
              operation: 'DELETE_MANY',
              diff: {
                where: (args as any).where ?? {},
                count: result.count,
              } as Prisma.InputJsonValue,
              requestId: ctx.requestId ?? null,
            },
          });
          return result;
        },

        async upsert({ model, args, query }) {
          if (AUDITED_MODELS[model]) {
            throw new Error(`upsert on audited model ${model} is not supported (audit bypass)`);
          }
          return query(args);
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

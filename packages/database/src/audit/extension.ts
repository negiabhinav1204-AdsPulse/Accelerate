import { PrismaClient } from '@prisma/client';
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
                diff,
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

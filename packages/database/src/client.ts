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

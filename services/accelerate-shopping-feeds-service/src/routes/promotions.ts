/**
 * GET  /shopping-feeds/promotions?orgId=
 * POST /shopping-feeds/promotions
 * PATCH /shopping-feeds/promotions/:id
 * DELETE /shopping-feeds/promotions/:id?orgId=
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

function deriveStatus(startDate: Date, endDate: Date): string {
  const now = new Date();
  if (now < startDate) return 'scheduled';
  if (now > endDate) return 'expired';
  return 'active';
}

export async function promotionsRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/promotions', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const promotions = await prisma.merchantPromotion.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
    const enriched = promotions.map((p) => ({ ...p, status: deriveStatus(p.startDate, p.endDate) }));
    return { promotions: enriched };
  });

  fastify.post<{
    Body: {
      orgId: string; title: string; offerType: string; couponCode?: string; discountType: string;
      discountValue?: number; minimumPurchaseAmount?: number; startDate: string; endDate: string;
      applicableProducts: string; productIds?: string[]; channels: string[];
    }
  }>(
    '/shopping-feeds/promotions',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { orgId, title, offerType, couponCode, discountType, discountValue, minimumPurchaseAmount, startDate, endDate, applicableProducts, productIds, channels } = request.body ?? {};
      if (!orgId || !title || !offerType || !startDate || !endDate) return reply.status(400).send({ error: 'orgId, title, offerType, startDate, endDate required' });
      const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId }, select: { id: true } });
      if (!store) return reply.status(400).send({ error: 'No connected store found' });
      const start = new Date(startDate);
      const end = new Date(endDate);
      const promotion = await prisma.merchantPromotion.create({
        data: {
          organizationId: orgId, connectorId: store.id, title, offerType,
          couponCode: couponCode ?? null, discountType, discountValue: discountValue != null ? discountValue : null,
          minimumPurchaseAmount: minimumPurchaseAmount != null ? minimumPurchaseAmount : null,
          startDate: start, endDate: end, applicableProducts: applicableProducts ?? 'all',
          productIds: productIds ?? [], channels, status: deriveStatus(start, end)
        }
      });
      return reply.status(201).send({ promotion });
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: {
      orgId: string; title?: string; offerType?: string; couponCode?: string | null; discountType?: string;
      discountValue?: number | null; minimumPurchaseAmount?: number | null; startDate?: string; endDate?: string;
      applicableProducts?: string; productIds?: string[]; channels?: string[];
    }
  }>(
    '/shopping-feeds/promotions/:id',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { id } = request.params;
      const { orgId, ...fields } = request.body ?? {};
      if (!orgId) return reply.status(400).send({ error: 'orgId required' });
      const existing = await prisma.merchantPromotion.findFirst({ where: { id, organizationId: orgId }, select: { id: true, startDate: true, endDate: true } });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      const start = fields.startDate ? new Date(fields.startDate) : existing.startDate;
      const end = fields.endDate ? new Date(fields.endDate) : existing.endDate;
      const updated = await prisma.merchantPromotion.update({
        where: { id },
        data: {
          ...(fields.title !== undefined && { title: fields.title }),
          ...(fields.offerType !== undefined && { offerType: fields.offerType }),
          ...('couponCode' in fields && { couponCode: fields.couponCode ?? null }),
          ...(fields.discountType !== undefined && { discountType: fields.discountType }),
          ...('discountValue' in fields && { discountValue: fields.discountValue ?? null }),
          ...('minimumPurchaseAmount' in fields && { minimumPurchaseAmount: fields.minimumPurchaseAmount ?? null }),
          ...(fields.startDate !== undefined && { startDate: start }),
          ...(fields.endDate !== undefined && { endDate: end }),
          ...(fields.applicableProducts !== undefined && { applicableProducts: fields.applicableProducts }),
          ...(fields.productIds !== undefined && { productIds: fields.productIds }),
          ...(fields.channels !== undefined && { channels: fields.channels }),
          status: deriveStatus(start, end)
        }
      });
      return { promotion: updated };
    }
  );

  fastify.delete<{ Params: { id: string } }>('/shopping-feeds/promotions/:id', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { id } = request.params;
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const existing = await prisma.merchantPromotion.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.merchantPromotion.delete({ where: { id } });
    return { success: true };
  });
}

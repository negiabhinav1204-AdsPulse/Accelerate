/**
 * GET  /shopping-feeds/locations?orgId=
 * POST /shopping-feeds/locations
 * PATCH /shopping-feeds/locations/:id
 * DELETE /shopping-feeds/locations/:id?orgId=
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

const DEFAULT_HOURS = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '10:00', close: '16:00', closed: false },
  sunday: { open: '10:00', close: '16:00', closed: true }
};

export async function locationsRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/locations', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const locations = await prisma.storeLocation.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' } });
    return { locations };
  });

  fastify.post<{ Body: { orgId: string; storeCode: string; name: string; address: string; city: string; state?: string; country: string; postalCode: string; phone?: string; hours?: object } }>(
    '/shopping-feeds/locations',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { orgId, storeCode, name, address, city, state, country, postalCode, phone, hours } = request.body ?? {};
      if (!orgId || !storeCode || !name || !address || !city || !country || !postalCode) return reply.status(400).send({ error: 'Required fields missing' });
      const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
      if (!store) return reply.status(400).send({ error: 'No connected store' });
      const location = await prisma.storeLocation.create({ data: { organizationId: orgId, connectorId: store.id, storeCode, name, address, city, state: state ?? null, country, postalCode, phone: phone ?? null, hours: (hours ?? DEFAULT_HOURS) as object } });
      return reply.status(201).send({ location });
    }
  );

  fastify.patch<{ Params: { id: string }; Body: { orgId: string; storeCode?: string; name?: string; address?: string; city?: string; state?: string | null; country?: string; postalCode?: string; phone?: string | null; hours?: object; isActive?: boolean } }>(
    '/shopping-feeds/locations/:id',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { id } = request.params;
      const { orgId, ...fields } = request.body ?? {};
      if (!orgId) return reply.status(400).send({ error: 'orgId required' });
      const existing = await prisma.storeLocation.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      const updated = await prisma.storeLocation.update({
        where: { id },
        data: {
          ...(fields.storeCode !== undefined && { storeCode: fields.storeCode }),
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.address !== undefined && { address: fields.address }),
          ...(fields.city !== undefined && { city: fields.city }),
          ...('state' in fields && { state: fields.state ?? null }),
          ...(fields.country !== undefined && { country: fields.country }),
          ...(fields.postalCode !== undefined && { postalCode: fields.postalCode }),
          ...('phone' in fields && { phone: fields.phone ?? null }),
          ...(fields.hours !== undefined && { hours: fields.hours }),
          ...(fields.isActive !== undefined && { isActive: fields.isActive })
        }
      });
      return { location: updated };
    }
  );

  fastify.delete<{ Params: { id: string } }>('/shopping-feeds/locations/:id', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { id } = request.params;
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });
    const existing = await prisma.storeLocation.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.storeLocation.delete({ where: { id } });
    return { success: true };
  });
}

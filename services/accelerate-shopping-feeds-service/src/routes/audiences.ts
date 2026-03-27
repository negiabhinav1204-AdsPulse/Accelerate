/**
 * GET  /shopping-feeds/audiences?orgId=
 * POST /shopping-feeds/audiences
 * PATCH /shopping-feeds/audiences/:id
 * DELETE /shopping-feeds/audiences/:id?orgId=
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

const MOCK_CONTACTS = [
  { name: 'Priya Sharma', email: 'priya.sharma@example.com', phone: '+91-9876543210', tags: ['vip', 'newsletter'] },
  { name: 'Rohan Mehta', email: 'rohan.mehta@example.com', phone: '+91-9123456789', tags: ['newsletter'] },
  { name: 'Ananya Patel', email: 'ananya.patel@example.com', phone: '+91-9988776655', tags: ['vip', 'repeat-buyer'] },
  { name: 'Karan Singh', email: 'karan.singh@example.com', phone: '+91-9871234567', tags: ['refunded'] },
  { name: 'Sneha Joshi', email: 'sneha.joshi@example.com', phone: '+91-9765432109', tags: ['newsletter', 'repeat-buyer'] },
  { name: 'Arjun Nair', email: 'arjun.nair@example.com', phone: '+91-9654321098', tags: ['vip'] },
  { name: 'Divya Reddy', email: 'divya.reddy@example.com', phone: '+91-9543210987', tags: ['newsletter'] },
  { name: 'Vikram Gupta', email: 'vikram.gupta@example.com', phone: '+91-9432109876', tags: ['repeat-buyer'] },
  { name: 'Meera Iyer', email: 'meera.iyer@example.com', phone: '+91-9321098765', tags: ['vip', 'newsletter'] },
  { name: 'Aditya Kumar', email: 'aditya.kumar@example.com', phone: '+91-9210987654', tags: [] },
  { name: 'Lakshmi Venkat', email: 'lakshmi.v@example.com', phone: '+91-9109876543', tags: ['newsletter'] },
  { name: 'Rahul Bose', email: 'rahul.bose@example.com', phone: '+91-9098765432', tags: ['refunded'] },
  { name: 'Pooja Desai', email: 'pooja.desai@example.com', phone: '+91-8987654321', tags: ['vip', 'repeat-buyer'] },
  { name: 'Nikhil Rao', email: 'nikhil.rao@example.com', phone: '+91-8876543210', tags: ['newsletter'] },
  { name: 'Shreya Kapoor', email: 'shreya.kapoor@example.com', phone: '+91-8765432109', tags: ['repeat-buyer'] },
  { name: 'Amit Shah', email: 'amit.shah@example.com', phone: '+91-8654321098', tags: [] },
  { name: 'Ritu Verma', email: 'ritu.verma@example.com', phone: '+91-8543210987', tags: ['vip'] },
  { name: 'Sanjay Malhotra', email: 'sanjay.malhotra@example.com', phone: '+91-8432109876', tags: ['newsletter', 'refunded'] },
  { name: 'Isha Choudhury', email: 'isha.choudhury@example.com', phone: '+91-8321098765', tags: [] },
  { name: 'Dev Khanna', email: 'dev.khanna@example.com', phone: '+91-8210987654', tags: ['vip', 'newsletter', 'repeat-buyer'] }
];

async function ensureMockData(orgId: string): Promise<void> {
  const existing = await prisma.contact.count({ where: { organizationId: orgId } });
  if (existing > 0) return;

  for (const c of MOCK_CONTACTS) {
    const contact = await prisma.contact.create({ data: { organizationId: orgId, name: c.name, email: c.email, phone: c.phone } });
    for (const tagText of c.tags) {
      const tag = await prisma.contactTag.upsert({ where: { text: tagText }, update: {}, create: { text: tagText } });
      await prisma.contact.update({ where: { id: contact.id }, data: { tags: { connect: { id: tag.id } } } });
    }
  }

  const mockOrders = [
    { status: 'completed', totalAmount: 4500, currency: 'INR' }, { status: 'completed', totalAmount: 12000, currency: 'INR' },
    { status: 'completed', totalAmount: 850, currency: 'INR' }, { status: 'refunded', totalAmount: 2300, currency: 'INR' },
    { status: 'completed', totalAmount: 6750, currency: 'INR' }, { status: 'completed', totalAmount: 18500, currency: 'INR' },
    { status: 'completed', totalAmount: 3200, currency: 'INR' }, { status: 'completed', totalAmount: 9900, currency: 'INR' },
    { status: 'refunded', totalAmount: 1500, currency: 'INR' }, { status: 'completed', totalAmount: 22000, currency: 'INR' }
  ];
  for (const o of mockOrders) {
    await prisma.order.create({ data: { id: `mock-order-${Math.random().toString(36).slice(2)}`, organizationId: orgId, status: o.status, provider: 'shopify', totalAmount: o.totalAmount, currency: o.currency } });
  }
}

type AudienceRule = { field: string; operator: string; value: string; logic: 'AND' | 'OR' };

async function estimateSize(orgId: string, rules: AudienceRule[]): Promise<number> {
  if (rules.length === 0) return prisma.contact.count({ where: { organizationId: orgId } });
  const totalContacts = await prisma.contact.count({ where: { organizationId: orgId } });
  const totalOrders = await prisma.order.count({ where: { organizationId: orgId } });
  let estimate = totalContacts;

  for (const rule of rules) {
    switch (rule.field) {
      case 'customer_tag': {
        const count = await prisma.contact.count({ where: { organizationId: orgId, tags: { some: { text: { contains: rule.value, mode: 'insensitive' } } } } });
        estimate = Math.min(estimate, count); break;
      }
      case 'email_subscribed': {
        const count = await prisma.contact.count({ where: { organizationId: orgId, email: { not: null } } });
        estimate = Math.min(estimate, count); break;
      }
      case 'purchase_count': {
        const avgOrders = totalContacts > 0 ? totalOrders / totalContacts : 0;
        const threshold = parseFloat(rule.value);
        if (rule.operator === 'greater_than') estimate = Math.min(estimate, Math.floor(totalContacts * Math.max(0, 1 - threshold / (avgOrders + 1))));
        else if (rule.operator === 'less_than') estimate = Math.min(estimate, Math.floor(totalContacts * (threshold / (avgOrders + 1))));
        break;
      }
      case 'purchase_value': {
        const orders = await prisma.order.findMany({ where: { organizationId: orgId }, select: { totalAmount: true } });
        const threshold = parseFloat(rule.value);
        const qualifying = orders.filter((o) => { const amt = Number(o.totalAmount); if (rule.operator === 'greater_than') return amt > threshold; if (rule.operator === 'less_than') return amt < threshold; return amt === threshold; }).length;
        estimate = Math.min(estimate, Math.floor(totalContacts * (totalOrders > 0 ? qualifying / totalOrders : 0))); break;
      }
      case 'last_purchase_date': {
        const days = parseFloat(rule.value);
        const fraction = rule.operator === 'in_last_n_days' ? Math.min(days / 90, 1) : Math.max(1 - days / 90, 0);
        estimate = Math.min(estimate, Math.floor(totalContacts * fraction)); break;
      }
      default:
        estimate = Math.min(estimate, Math.floor(totalContacts * 0.5));
    }
  }
  return Math.max(estimate, 0);
}

export async function audiencesRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/audiences', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });

    await ensureMockData(orgId);
    const [audiences, totalContacts, totalOrders] = await Promise.all([
      prisma.audienceSegment.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } }),
      prisma.contact.count({ where: { organizationId: orgId } }),
      prisma.order.count({ where: { organizationId: orgId } })
    ]);
    return { audiences, stats: { totalContacts, totalOrders } };
  });

  fastify.post<{ Body: { orgId: string; name: string; description?: string; type: string; platforms: string[]; rules: AudienceRule[] } }>(
    '/shopping-feeds/audiences',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { orgId, name, description, type, platforms, rules } = request.body ?? {};
      if (!orgId || !name) return reply.status(400).send({ error: 'orgId and name required' });

      await ensureMockData(orgId);
      const estimatedSize = await estimateSize(orgId, rules ?? []);
      const audience = await prisma.audienceSegment.create({ data: { organizationId: orgId, name, description, type, platforms, rules: (rules ?? []) as object[], estimatedSize, syncStatus: 'pending' } });
      return reply.status(201).send({ audience });
    }
  );

  fastify.patch<{ Params: { id: string }; Body: { orgId: string; name?: string; description?: string; type?: string; platforms?: string[]; rules?: AudienceRule[]; syncStatus?: string; historicalImportDone?: boolean } }>(
    '/shopping-feeds/audiences/:id',
    async (request, reply) => {
      if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
      const { id } = request.params;
      const { orgId, ...fields } = request.body ?? {};
      if (!orgId) return reply.status(400).send({ error: 'orgId required' });

      const existing = await prisma.audienceSegment.findFirst({ where: { id, organizationId: orgId }, select: { id: true, rules: true } });
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      const rules = (fields.rules ?? (existing.rules as AudienceRule[]));
      const estimatedSize = await estimateSize(orgId, rules);
      const updated = await prisma.audienceSegment.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.description !== undefined && { description: fields.description }),
          ...(fields.type !== undefined && { type: fields.type }),
          ...(fields.platforms !== undefined && { platforms: fields.platforms }),
          ...(fields.rules !== undefined && { rules: fields.rules as object[] }),
          ...(fields.syncStatus !== undefined && { syncStatus: fields.syncStatus }),
          ...(fields.historicalImportDone !== undefined && { historicalImportDone: fields.historicalImportDone }),
          estimatedSize
        }
      });
      return { audience: updated };
    }
  );

  fastify.delete<{ Params: { id: string } }>('/shopping-feeds/audiences/:id', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { id } = request.params;
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });

    const existing = await prisma.audienceSegment.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.audienceSegment.delete({ where: { id } });
    return { success: true };
  });
}

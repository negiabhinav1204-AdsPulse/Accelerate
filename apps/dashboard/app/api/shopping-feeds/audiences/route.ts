import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { SERVICES, getService, callService } from '~/lib/service-router';

// Mock contacts injected when org has none — gives the demo life
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

  // Upsert mock contacts
  for (const c of MOCK_CONTACTS) {
    const contact = await prisma.contact.create({
      data: {
        organizationId: orgId,
        name: c.name,
        email: c.email,
        phone: c.phone
      }
    });

    // Upsert tags and link them
    for (const tagText of c.tags) {
      const tag = await prisma.contactTag.upsert({
        where: { text: tagText },
        update: {},
        create: { text: tagText }
      });
      await prisma.contact.update({
        where: { id: contact.id },
        data: { tags: { connect: { id: tag.id } } }
      });
    }
  }

  // Mock a few orders for the org
  const mockOrders = [
    { status: 'completed', totalAmount: 4500, currency: 'INR' },
    { status: 'completed', totalAmount: 12000, currency: 'INR' },
    { status: 'completed', totalAmount: 850, currency: 'INR' },
    { status: 'refunded', totalAmount: 2300, currency: 'INR' },
    { status: 'completed', totalAmount: 6750, currency: 'INR' },
    { status: 'completed', totalAmount: 18500, currency: 'INR' },
    { status: 'completed', totalAmount: 3200, currency: 'INR' },
    { status: 'completed', totalAmount: 9900, currency: 'INR' },
    { status: 'refunded', totalAmount: 1500, currency: 'INR' },
    { status: 'completed', totalAmount: 22000, currency: 'INR' }
  ];

  for (const o of mockOrders) {
    await prisma.order.create({
      data: {
        id: `mock-order-${Math.random().toString(36).slice(2)}`,
        organizationId: orgId,
        status: o.status,
        provider: 'shopify',
        totalAmount: o.totalAmount,
        currency: o.currency
      }
    });
  }
}

type AudienceRule = {
  field: string;
  operator: string;
  value: string;
  logic: 'AND' | 'OR';
};

async function estimateSize(orgId: string, rules: AudienceRule[]): Promise<number> {
  if (rules.length === 0) {
    return await prisma.contact.count({ where: { organizationId: orgId } });
  }

  const totalContacts = await prisma.contact.count({ where: { organizationId: orgId } });
  const totalOrders = await prisma.order.count({ where: { organizationId: orgId } });

  let estimate = totalContacts;

  for (const rule of rules) {
    switch (rule.field) {
      case 'customer_tag': {
        const count = await prisma.contact.count({
          where: {
            organizationId: orgId,
            tags: { some: { text: { contains: rule.value, mode: 'insensitive' } } }
          }
        });
        estimate = Math.min(estimate, count);
        break;
      }
      case 'email_subscribed': {
        const count = await prisma.contact.count({
          where: { organizationId: orgId, email: { not: null } }
        });
        estimate = Math.min(estimate, count);
        break;
      }
      case 'purchase_count': {
        // Approximate: if org has N orders across M contacts, estimate per contact
        const avgOrders = totalContacts > 0 ? totalOrders / totalContacts : 0;
        const threshold = parseFloat(rule.value);
        if (rule.operator === 'greater_than') {
          estimate = Math.min(estimate, Math.floor(totalContacts * Math.max(0, 1 - threshold / (avgOrders + 1))));
        } else if (rule.operator === 'less_than') {
          estimate = Math.min(estimate, Math.floor(totalContacts * (threshold / (avgOrders + 1))));
        }
        break;
      }
      case 'purchase_value': {
        const orders = await prisma.order.findMany({
          where: { organizationId: orgId },
          select: { totalAmount: true }
        });
        const threshold = parseFloat(rule.value);
        const qualifying = orders.filter((o) => {
          const amt = Number(o.totalAmount);
          if (rule.operator === 'greater_than') return amt > threshold;
          if (rule.operator === 'less_than') return amt < threshold;
          return amt === threshold;
        }).length;
        const ratio = totalOrders > 0 ? qualifying / totalOrders : 0;
        estimate = Math.min(estimate, Math.floor(totalContacts * ratio));
        break;
      }
      case 'last_purchase_date': {
        // Estimate: recent buyers as ~30% of contacts
        const days = parseFloat(rule.value);
        const fraction = rule.operator === 'in_last_n_days' ? Math.min(days / 90, 1) : Math.max(1 - days / 90, 0);
        estimate = Math.min(estimate, Math.floor(totalContacts * fraction));
        break;
      }
      default:
        estimate = Math.min(estimate, Math.floor(totalContacts * 0.5));
    }
  }

  return Math.max(estimate, 0);
}

/**
 * GET /api/shopping-feeds/audiences?orgId=...
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await getService(SERVICES.shoppingFeeds.url, `/shopping-feeds/audiences?orgId=${orgId}`);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  // Seed mock data if org has no contacts/orders yet
  await ensureMockData(orgId);

  const [audiences, totalContacts, totalOrders] = await Promise.all([
    prisma.audienceSegment.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.contact.count({ where: { organizationId: orgId } }),
    prisma.order.count({ where: { organizationId: orgId } })
  ]);

  return NextResponse.json({ audiences, stats: { totalContacts, totalOrders } });
}

/**
 * POST /api/shopping-feeds/audiences
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as {
    orgId: string;
    name: string;
    description?: string;
    type: string;
    platforms: string[];
    rules: AudienceRule[];
  };

  const { orgId, name, description, type, platforms, rules } = body;
  if (!orgId || !name) return NextResponse.json({ error: 'orgId and name required' }, { status: 400 });

  const membership = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true }
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (SERVICES.shoppingFeeds.enabled) {
    const res = await callService(SERVICES.shoppingFeeds.url, '/shopping-feeds/audiences', body);
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  }

  await ensureMockData(orgId);
  const estimatedSize = await estimateSize(orgId, rules);

  const audience = await prisma.audienceSegment.create({
    data: {
      organizationId: orgId,
      name,
      description,
      type,
      platforms,
      rules: rules as object[],
      estimatedSize,
      syncStatus: 'pending'
    }
  });

  return NextResponse.json({ audience }, { status: 201 });
}

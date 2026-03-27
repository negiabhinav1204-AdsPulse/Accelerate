/**
 * GET  /shopping-feeds/settings?orgId=
 * PATCH /shopping-feeds/settings
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

type SettingsPatchBody = {
  orgId: string;
  titlePreference?: string;
  descriptionPreference?: string;
  variantPreference?: string;
  appendVariantToTitle?: boolean;
  inventoryPolicy?: string;
  useSecondImage?: boolean;
  submitAdditionalImages?: boolean;
  richDescriptions?: boolean;
  enableSalePrice?: boolean;
  enableUtmTracking?: boolean;
  productIdFormat?: string;
  defaultGoogleCategory?: string | null;
  defaultAgeGroup?: string | null;
  merchantCenterId?: string | null;
  channels?: string[];
};

export async function settingsRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/settings', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });

    const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
    if (!store) return { hasStore: false };

    let settings = await prisma.shoppingFeedSettings.findUnique({ where: { connectorId: store.id } });
    if (!settings) {
      settings = await prisma.shoppingFeedSettings.create({ data: { organizationId: orgId, connectorId: store.id } });
    }

    const [googleAccount, metaAccount, bingAccount] = await Promise.all([
      prisma.connectedAdAccount.findFirst({ where: { organizationId: orgId, platform: 'google', archivedAt: null, isDefault: true }, select: { accountId: true, accountName: true } }),
      prisma.connectedAdAccount.findFirst({ where: { organizationId: orgId, platform: 'meta', archivedAt: null, isDefault: true }, select: { accountId: true, accountName: true } }),
      prisma.connectedAdAccount.findFirst({ where: { organizationId: orgId, platform: 'bing', archivedAt: null, isDefault: true }, select: { accountId: true, accountName: true } })
    ]);

    return { hasStore: true, settings, connectedAccounts: { google: googleAccount, meta: metaAccount, bing: bingAccount } };
  });

  fastify.patch<{ Body: SettingsPatchBody }>('/shopping-feeds/settings', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });
    const { orgId, ...fields } = request.body ?? {};
    if (!orgId) return reply.status(400).send({ error: 'orgId required' });

    const store = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { id: true } });
    if (!store) return reply.status(404).send({ error: 'No connected store found' });

    const updated = await prisma.shoppingFeedSettings.upsert({
      where: { connectorId: store.id },
      create: { organizationId: orgId, connectorId: store.id, ...fields },
      update: fields
    });
    return { settings: updated };
  });
}

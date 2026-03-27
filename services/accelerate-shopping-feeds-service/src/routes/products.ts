/**
 * GET /shopping-feeds/products?channel=&status=&search=
 */
import type { FastifyInstance } from 'fastify';
import { MOCK_SHOPIFY_PRODUCTS, MOCK_SHOPIFY_STORE } from '../lib/shopify-mock';

function verifyKey(h: Record<string, unknown>): boolean {
  const key = process.env.INTERNAL_API_KEY;
  return !key || h['x-internal-api-key'] === key;
}

export async function productsRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/products', async (request, reply) => {
    if (!verifyKey(request.headers as Record<string, unknown>)) return reply.status(401).send({ error: 'Unauthorized' });

    const { channel = 'all', status = 'all', search = '' } = request.query as Record<string, string>;
    const searchLower = search.toLowerCase();

    let products = [...MOCK_SHOPIFY_PRODUCTS];

    if (searchLower) {
      products = products.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.sku.toLowerCase().includes(searchLower) ||
          p.brand.toLowerCase().includes(searchLower)
      );
    }

    if (channel !== 'all') {
      products = products.filter((p) => p.channelStatus[channel as keyof typeof p.channelStatus] !== undefined);
    }

    if (status !== 'all') {
      products = products.filter((p) => {
        const statuses = Object.values(p.channelStatus);
        if (status === 'approved') return statuses.some((s) => s === 'approved' || s === 'active');
        if (status === 'pending') return statuses.some((s) => s === 'pending');
        if (status === 'disapproved') return statuses.some((s) => s === 'disapproved');
        if (status === 'not_submitted') return statuses.every((s) => s === 'not_submitted');
        return true;
      });
    }

    return { store: MOCK_SHOPIFY_STORE, products, total: products.length };
  });
}

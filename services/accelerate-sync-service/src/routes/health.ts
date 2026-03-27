import type { FastifyInstance } from 'fastify';

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'accelerate-sync-service',
    timestamp: new Date().toISOString(),
  }));
}

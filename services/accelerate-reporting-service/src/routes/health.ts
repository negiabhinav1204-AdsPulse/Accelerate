import type { FastifyInstance } from 'fastify';

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'accelerate-reporting-service',
    timestamp: new Date().toISOString(),
  }));
}

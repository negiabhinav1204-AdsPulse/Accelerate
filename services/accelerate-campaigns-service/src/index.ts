import Fastify from 'fastify';
import cors from '@fastify/cors';
import { enterContext, type RequestContext } from '@workspace/common/context';
import { healthRoute } from './routes/health.js';
import { campaignsRoute } from './routes/campaigns.js';
import { publishRoute } from './routes/publish.js';

const server = Fastify({ logger: true });

server.addHook('onRequest', (request, _reply, done) => {
  const ctx: RequestContext = {
    actorId: (request.headers['x-user-id'] as string) || undefined,
    orgId: (request.headers['x-org-id'] as string) || undefined,
    requestId: (request.headers['x-request-id'] as string) || undefined,
    actorType: request.headers['x-internal-api-key'] ? 'agent' : 'user',
  };
  enterContext(ctx);
  done();
});

server.register(cors);
server.register(healthRoute);
server.register(campaignsRoute);
server.register(publishRoute);

const start = async () => {
  try {
    const port = parseInt(process.env.PORT ?? '8088', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Campaigns service running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

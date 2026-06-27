import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health.js';
import { campaignsRoute } from './routes/campaigns.js';
import { publishRoute } from './routes/publish.js';
import { applyRoute } from './routes/apply.js';
import { registerRequestContext } from './request-context-hook.js';

const server = Fastify({ logger: true });

registerRequestContext(server);

server.register(cors);
server.register(healthRoute);
server.register(campaignsRoute);
server.register(publishRoute);
server.register(applyRoute);

const start = async () => {
  // I3: Fail-fast FIELD_ENCRYPTION_KEY check — must be present and decode to 32 bytes.
  const k = process.env.FIELD_ENCRYPTION_KEY;
  const okLen =
    k && (/^[0-9a-fA-F]{64}$/.test(k) ? 32 : Buffer.from(k, 'base64').length) === 32;
  if (!okLen) {
    server.log.error('FIELD_ENCRYPTION_KEY must be set and decode to 32 bytes');
    process.exit(1);
  }

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

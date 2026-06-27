import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health.js';
import { campaignsRoute } from './routes/campaigns.js';
import { publishRoute } from './routes/publish.js';
import { applyRoute } from './routes/apply.js';
import { registerRequestContext } from './request-context-hook.js';
import { assertEncryptionKey } from '@workspace/common/crypto';

const server = Fastify({ logger: true });

registerRequestContext(server);

server.register(cors);
server.register(healthRoute);
server.register(campaignsRoute);
server.register(publishRoute);
server.register(applyRoute);

const start = async () => {
  // Fail-fast: ensure FIELD_ENCRYPTION_KEY is present and valid before accepting traffic.
  try {
    assertEncryptionKey();
  } catch (err) {
    server.log.error(err instanceof Error ? err.message : String(err));
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

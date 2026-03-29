import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health';
import { campaignsRoute } from './routes/campaigns';
import { publishRoute } from './routes/publish';

const server = Fastify({ logger: true });

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

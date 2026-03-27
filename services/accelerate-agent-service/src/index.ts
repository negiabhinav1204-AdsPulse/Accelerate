import Fastify from 'fastify';
import cors from '@fastify/cors';
import { runRoute } from './routes/run';
import { healthRoute } from './routes/health';
import { mediaPlannerRoute } from './routes/media-planner';

const server = Fastify({ logger: true });

server.register(cors);
server.register(healthRoute);
server.register(runRoute);
server.register(mediaPlannerRoute);

const start = async () => {
  try {
    const port = parseInt(process.env.PORT ?? '8080', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Agent service running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

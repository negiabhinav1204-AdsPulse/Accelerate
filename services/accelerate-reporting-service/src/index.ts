import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health';
import { reportRoute } from './routes/report';

const server = Fastify({ logger: true });

server.register(cors);
server.register(healthRoute);
server.register(reportRoute);

const start = async () => {
  try {
    const port = parseInt(process.env.PORT ?? '8080', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Reporting service running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

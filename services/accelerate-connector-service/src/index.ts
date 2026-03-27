import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoute } from './routes/health';
import { accountsRoute } from './routes/accounts';
import { accountRoute } from './routes/account';
import { disconnectRoute } from './routes/disconnect';

const server = Fastify({ logger: true });

server.register(cors);
server.register(healthRoute);
server.register(accountsRoute);
server.register(accountRoute);
server.register(disconnectRoute);

const start = async () => {
  try {
    const port = parseInt(process.env.PORT ?? '8080', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Connector service running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

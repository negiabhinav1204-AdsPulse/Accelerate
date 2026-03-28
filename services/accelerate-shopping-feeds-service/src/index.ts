import Fastify from 'fastify';
import cors from '@fastify/cors';

import { healthRoute } from './routes/health';
import { feedHealthRoute } from './routes/feed-health';
import { advancedSettingsRoute } from './routes/advanced-settings';
import { audiencesRoute } from './routes/audiences';
import { deliveryRulesRoute } from './routes/delivery-rules';
import { locationsRoute } from './routes/locations';
import { marketsRoute } from './routes/markets';
import { productsRoute } from './routes/products';
import { promotionsRoute } from './routes/promotions';
import { rulesRoute } from './routes/rules';
import { settingsRoute } from './routes/settings';
import { syncRoute } from './routes/sync';
import { xmlRoute } from './routes/xml';
import { zombieRoute } from './routes/zombie';

const fastify = Fastify({ logger: true });

void fastify.register(cors, { origin: true });

void fastify.register(healthRoute);
void fastify.register(feedHealthRoute);
void fastify.register(advancedSettingsRoute);
void fastify.register(audiencesRoute);
void fastify.register(deliveryRulesRoute);
void fastify.register(locationsRoute);
void fastify.register(marketsRoute);
void fastify.register(productsRoute);
void fastify.register(promotionsRoute);
void fastify.register(rulesRoute);
void fastify.register(settingsRoute);
void fastify.register(syncRoute);
void fastify.register(xmlRoute);
void fastify.register(zombieRoute);

const port = parseInt(process.env.PORT ?? '8080', 10);

fastify.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});

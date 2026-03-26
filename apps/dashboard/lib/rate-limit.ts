import { Ratelimit } from '@upstash/ratelimit';

import { redis } from '~/lib/redis';

// AI campaign creation: 10 requests per hour per user
export const aiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
  prefix: 'ratelimit:ai'
});

// General API: 200 requests per minute per user
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, '1 m'),
  analytics: true,
  prefix: 'ratelimit:api'
});

// Chat: 60 messages per minute per user
export const chatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: true,
  prefix: 'ratelimit:chat'
});

import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const TTL = {
  REPORTING: 60 * 5, // 5 minutes
} as const;

export function orgKey(orgId: string, suffix: string): string {
  return `org:${orgId}:${suffix}`;
}

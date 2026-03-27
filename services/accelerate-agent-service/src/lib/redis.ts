import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const TTL = {
  ORG_DETAILS: 60 * 60,
  CAMPAIGNS: 60 * 5,
  REPORTING: 60 * 5,
  CONNECTED_ACCOUNTS: 60 * 30,
  CHAT_SESSIONS: 60 * 10,
  JOB_RESULT: 60 * 60 * 24,
} as const;

export function orgKey(orgId: string, suffix: string): string {
  return `org:${orgId}:${suffix}`;
}

export function userKey(userId: string, suffix: string): string {
  return `user:${userId}:${suffix}`;
}

export function jobKey(jobId: string): string {
  return `job:${jobId}`;
}

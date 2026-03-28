import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

// TTL constants (seconds)
export const TTL = {
  ORG_DETAILS: 60 * 60,       // 1 hour
  CAMPAIGNS: 60 * 5,          // 5 minutes
  REPORTING: 60 * 5,          // 5 minutes
  CONNECTED_ACCOUNTS: 60 * 30, // 30 minutes
  CHAT_SESSIONS: 60 * 10,     // 10 minutes
  JOB_RESULT: 60 * 60 * 24   // 24 hours (campaign generation results)
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

/** Separate Redis list key for job events — allows atomic RPUSH without read-modify-write races */
export function jobEventsKey(jobId: string): string {
  return `job:${jobId}:events`;
}

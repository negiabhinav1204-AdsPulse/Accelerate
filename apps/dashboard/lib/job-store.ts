/**
 * Redis-backed job store for async campaign generation.
 *
 * Jobs are stored as:
 *   job:{jobId} → JobRecord (TTL 24h)
 *
 * This lets the frontend poll for status if the SSE connection drops,
 * and is the foundation for the full QStash async pipeline.
 */

import { jobKey, redis, TTL } from '~/lib/redis';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type JobEvent = {
  type: string;
  [key: string]: unknown;
};

export type JobRecord = {
  jobId: string;
  orgId: string;
  userId: string;
  status: JobStatus;
  url: string;
  createdAt: string;
  updatedAt: string;
  events: JobEvent[];       // Accumulated agent events
  campaignId?: string;      // Set once campaign is saved to DB
  error?: string;
};

export async function createJob(params: {
  jobId: string;
  orgId: string;
  userId: string;
  url: string;
}): Promise<JobRecord> {
  const now = new Date().toISOString();
  const record: JobRecord = {
    ...params,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    events: []
  };
  await redis.setex(jobKey(params.jobId), TTL.JOB_RESULT, record);
  return record;
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  return redis.get<JobRecord>(jobKey(jobId));
}

export async function updateJob(
  jobId: string,
  patch: Partial<Pick<JobRecord, 'status' | 'campaignId' | 'error'>> & { event?: JobEvent }
): Promise<void> {
  const existing = await getJob(jobId);
  if (!existing) return;

  const updated: JobRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
    events: patch.event ? [...existing.events, patch.event] : existing.events
  };
  // Preserve remaining TTL by re-setting with full TTL
  await redis.setex(jobKey(jobId), TTL.JOB_RESULT, updated);
}

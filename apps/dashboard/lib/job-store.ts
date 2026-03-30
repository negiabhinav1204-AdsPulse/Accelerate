/**
 * Redis-backed job store for async campaign generation.
 *
 * Job metadata (status, campaignId, error) is stored as JSON:
 *   job:{jobId} → JobMeta (TTL 24h)
 *
 * Agent events are stored as a Redis list for atomic concurrent appends:
 *   job:{jobId}:events → [JobEvent, ...] (RPUSH — no read-modify-write race)
 *
 * Using RPUSH prevents the race condition where concurrent enqueue() calls
 * (e.g. creative + budget agents running in parallel) overwrite each other's
 * events via a read-modify-write cycle.
 */

import { jobEventsKey, jobKey, redis, TTL } from '~/lib/redis';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type JobEvent = {
  type: string;
  [key: string]: unknown;
};

type JobMeta = {
  jobId: string;
  orgId: string;
  userId: string;
  status: JobStatus;
  url: string;
  createdAt: string;
  updatedAt: string;
  campaignId?: string;
  error?: string;
};

export type JobRecord = JobMeta & { events: JobEvent[] };

export async function createJob(params: {
  jobId: string;
  orgId: string;
  userId: string;
  url: string;
}): Promise<JobRecord> {
  const now = new Date().toISOString();
  const meta: JobMeta = { ...params, status: 'pending', createdAt: now, updatedAt: now };
  await redis.setex(jobKey(params.jobId), TTL.JOB_RESULT, meta);
  return { ...meta, events: [] };
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  // Fetch meta and events independently so a bloated events list (e.g. from
  // base64 images stored before the CDN-only guard was in place) doesn't
  // prevent reading the job meta or marking the job as failed.
  const meta = await redis.get<JobMeta>(jobKey(jobId));
  if (!meta) return null;

  let events: JobEvent[] = [];
  try {
    events = (await redis.lrange<JobEvent>(jobEventsKey(jobId), 0, -1)) ?? [];
  } catch {
    // Events list too large to read (> Upstash 10MB limit) — return meta only.
    // This happens when base64 images were stored before the CDN-only guard.
    // The campaign data is still in the DB; only the live event stream is lost.
  }

  return { ...meta, events };
}

/**
 * Append a single event to the job's event list.
 * RPUSH is atomic — safe for concurrent callers (e.g. parallel agents).
 */
export async function appendJobEvent(jobId: string, event: JobEvent): Promise<void> {
  await redis.rpush(jobEventsKey(jobId), event);
  void redis.expire(jobEventsKey(jobId), TTL.JOB_RESULT).catch(() => {});
}

/**
 * Update job metadata (status / campaignId / error).
 * Optionally include one event which is guaranteed to be written to the
 * events list BEFORE the metadata update — so the frontend will always
 * see the event when it polls after seeing the new status.
 *
 * Only called from serial code paths, so read-modify-write is safe here.
 */
export async function updateJob(
  jobId: string,
  patch: Partial<Pick<JobMeta, 'status' | 'campaignId' | 'error'>> & { event?: JobEvent }
): Promise<void> {
  const meta = await redis.get<JobMeta>(jobKey(jobId));
  if (!meta) return;

  const { event, ...metaPatch } = patch;

  // Append event first — guarantees it's visible before the status change
  if (event) {
    await appendJobEvent(jobId, event);
  }

  const updatedMeta: JobMeta = { ...meta, ...metaPatch, updatedAt: new Date().toISOString() };
  await redis.setex(jobKey(jobId), TTL.JOB_RESULT, updatedMeta);
}

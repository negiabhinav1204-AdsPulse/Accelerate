import { jobKey, redis, TTL } from './redis';

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
  events: JobEvent[];
  campaignId?: string;
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
    events: [],
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
    events: patch.event ? [...existing.events, patch.event] : existing.events,
  };
  await redis.setex(jobKey(jobId), TTL.JOB_RESULT, updated);
}

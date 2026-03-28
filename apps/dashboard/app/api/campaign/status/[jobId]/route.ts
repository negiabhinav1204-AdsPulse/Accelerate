/**
 * GET /api/campaign/status/:jobId
 *
 * Polls job status for async campaign generation.
 * Frontend uses this to get the latest state if SSE connection drops,
 * or as the primary polling mechanism once QStash is enabled.
 *
 * Response:
 *   { status, events, campaignId?, error? }
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';

import { getJob } from '~/lib/job-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Verify the requesting user owns this job
  if (job.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    jobId: job.jobId,
    status: job.status,
    events: job.events,
    campaignId: job.campaignId ?? null,
    error: job.error ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });
}

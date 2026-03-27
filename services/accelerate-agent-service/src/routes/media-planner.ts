/**
 * Media Planner routes.
 *
 * POST /media-planner/run   — Trigger the 5-agent pipeline, stream SSE progress
 * GET  /media-planner/:planId — Poll plan status + result (from Redis)
 *
 * The pipeline runs synchronously with SSE streaming so the client gets
 * real-time agent progress. The final result is also stored in Redis for
 * 24h so the polling endpoint can serve it.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { redis, TTL } from '../lib/redis';
import { runMediaPlanningPipeline, type MediaPlannerProgressEvent, type MediaPlanResult } from '../agents/media-planner';

const runSchema = z.object({
  orgId: z.string().uuid(),
  budget: z.number().positive(),
  objective: z.string().default('max_conversions'),
  selectedPlatforms: z.array(z.string()).optional(),
});

function planKey(planId: string): string {
  return `media-plan:${planId}`;
}

type StoredPlan = {
  planId: string;
  orgId: string;
  status: 'running' | 'completed' | 'failed';
  result?: MediaPlanResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export async function mediaPlannerRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /media-planner/run
   * Triggers pipeline, streams SSE events.
   * Each SSE event is a JSON object: { type, agent, ... }
   */
  fastify.post('/media-planner/run', async (request, reply) => {
    let body: z.infer<typeof runSchema>;
    try {
      body = runSchema.parse(request.body);
    } catch (err) {
      return reply.status(400).send({ error: 'Invalid request body', detail: String(err) });
    }

    const { orgId, budget, objective, selectedPlatforms } = body;
    const planId = crypto.randomUUID();

    // Initialize plan record in Redis
    const now = new Date().toISOString();
    const stored: StoredPlan = {
      planId,
      orgId,
      status: 'running',
      createdAt: now,
      updatedAt: now,
    };
    await redis.setex(planKey(planId), TTL.JOB_RESULT, stored);

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Plan-Id': planId,
    });

    const send = (data: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send({ type: 'plan_started', planId, budget, objective });

    try {
      const result = await runMediaPlanningPipeline({
        orgId,
        budget,
        objective,
        selectedPlatforms,
        progressCallback: (event: MediaPlannerProgressEvent) => {
          if (event.status === 'running') {
            send({ type: 'agent_running', agent: event.agent, activity: event.activity });
          } else if (event.status === 'complete') {
            send({
              type: 'agent_complete',
              agent: event.agent,
              duration: event.duration,
              findings: event.findings,
            });
          } else if (event.status === 'error') {
            send({ type: 'agent_error', agent: event.agent, message: event.message });
          }
        },
      });

      // Store completed plan
      const completed: StoredPlan = {
        ...stored,
        status: 'completed',
        result,
        updatedAt: new Date().toISOString(),
      };
      await redis.setex(planKey(planId), TTL.JOB_RESULT, completed);

      send({ type: 'plan_complete', planId, result });
    } catch (err) {
      const failed: StoredPlan = {
        ...stored,
        status: 'failed',
        error: String(err),
        updatedAt: new Date().toISOString(),
      };
      await redis.setex(planKey(planId), TTL.JOB_RESULT, failed);
      send({ type: 'plan_error', error: String(err) });
    }

    reply.raw.end();
  });

  /**
   * GET /media-planner/:planId
   * Poll plan status and result.
   */
  fastify.get<{ Params: { planId: string } }>('/media-planner/:planId', async (request, reply) => {
    const { planId } = request.params;
    const stored = await redis.get<StoredPlan>(planKey(planId));
    if (!stored) {
      return reply.status(404).send({ error: 'Plan not found' });
    }
    return reply.send(stored);
  });
}

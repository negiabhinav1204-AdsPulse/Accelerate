import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Verify x-internal-api-key header — same pattern as all Accelerate microservices.
 */
export function verifyInternalKey(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const key = request.headers['x-internal-api-key'];
  const expected = process.env.INTERNAL_API_KEY;

  if (!expected) {
    done(); // No key configured — allow all (dev mode)
    return;
  }

  if (key !== expected) {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  done();
}

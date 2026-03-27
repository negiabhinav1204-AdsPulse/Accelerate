import type { FastifyRequest } from 'fastify';
import { Receiver } from '@upstash/qstash';

let receiver: Receiver | null = null;

function getReceiver(): Receiver {
  if (!receiver) {
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentSigningKey || !nextSigningKey) {
      throw new Error('QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY must be set');
    }
    receiver = new Receiver({ currentSigningKey, nextSigningKey });
  }
  return receiver;
}

export async function verifyQStashSignature(request: FastifyRequest): Promise<boolean> {
  // In local dev, skip verification
  if (process.env.NODE_ENV === 'development') return true;

  // Accept requests from the dashboard via INTERNAL_API_KEY
  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey && request.headers['x-internal-api-key'] === internalKey) {
    return true;
  }

  // Accept QStash webhook signature
  try {
    const signature = request.headers['upstash-signature'] as string;
    if (!signature) return false;

    const body = JSON.stringify(request.body);
    await getReceiver().verify({ signature, body });
    return true;
  } catch {
    return false;
  }
}

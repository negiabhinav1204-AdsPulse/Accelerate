import 'server-only';

import { unstable_cache as cache } from 'next/cache';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { NotFoundError } from '@workspace/common/errors';
import { prisma } from '@workspace/database/client';

import {
  Caching,
  defaultRevalidateTimeInSeconds,
  OrganizationCacheKey
} from '~/data/caching';
import { orgKey, redis, TTL } from '~/lib/redis';
import type { OrganizationDetailsDto } from '~/types/dtos/organization-details-dto';

export async function getOrganizationDetails(): Promise<OrganizationDetailsDto> {
  const ctx = await getAuthOrganizationContext();
  const cacheKey = orgKey(ctx.organization.id, 'details');

  // 1. Check Redis first (shared across all serverless instances)
  try {
    const cached = await redis.get<OrganizationDetailsDto>(cacheKey);
    if (cached) return cached;
  } catch {
    // Redis unavailable — fall through to DB
  }

  // 2. Fetch from DB via Next.js unstable_cache (per-instance memory cache)
  const result = await cache(
    async () => {
      const organization = await prisma.organization.findFirst({
        where: { id: ctx.organization.id },
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          website: true,
          location: true,
          currency: true
        }
      });
      if (!organization) {
        throw new NotFoundError('Organization not found');
      }

      const response: OrganizationDetailsDto = {
        name: organization.name,
        address: organization.address ? organization.address : undefined,
        phone: organization.phone ? organization.phone : undefined,
        email: organization.email ? organization.email : undefined,
        website: organization.website ? organization.website : undefined,
        location: organization.location ? organization.location : undefined,
        currency: organization.currency ? organization.currency : undefined
      };

      return response;
    },
    Caching.createOrganizationKeyParts(
      OrganizationCacheKey.OrganizationDetails,
      ctx.organization.id
    ),
    {
      revalidate: defaultRevalidateTimeInSeconds,
      tags: [
        Caching.createOrganizationTag(
          OrganizationCacheKey.OrganizationDetails,
          ctx.organization.id
        )
      ]
    }
  )();

  // 3. Populate Redis for next request
  try {
    await redis.setex(cacheKey, TTL.ORG_DETAILS, result);
  } catch {
    // Non-fatal
  }

  return result;
}

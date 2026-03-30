import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getRedirectToSignIn } from '@workspace/auth/redirect';
import { checkSession } from '@workspace/auth/session';
import { prisma } from '@workspace/database/client';
import { routes } from '@workspace/routes';

import { dedupedAuth, signOut } from '.';

// Cache org query across requests (5 min TTL) — avoids hitting Neon on every navigation
async function cachedGetOrganizationBySlug(slug: string) {
  return unstable_cache(
    async () => {
      const organization = await prisma.organization.findFirst({
        where: { slug },
        select: {
          id: true,
          logo: true,
          name: true,
          email: true,
          slug: true,
          memberships: {
            select: {
              userId: true
            }
          },
          billingCustomerId: true,
          subscriptions: {
            select: {
              id: true,
              active: true,
              status: true,
              cancelAtPeriodEnd: true,
              currency: true,
              provider: true,
              trialStartsAt: true,
              trialEndsAt: true,
              periodStartsAt: true,
              periodEndsAt: true,
              items: true
            }
          },
          orders: {
            select: {
              id: true,
              status: true,
              currency: true,
              provider: true,
              items: true
            }
          }
        }
      });
      if (!organization) return null;
      return {
        ...organization,
        logo: organization.logo ? organization.logo : undefined
      };
    },
    ['org-context', slug],
    { revalidate: 300, tags: [`org-context:${slug}`] }
  )();
}

// Cache user info across requests (5 min TTL) — avoids hitting Neon on every navigation
async function cachedGetUserInfo(userId: string) {
  return unstable_cache(
    async () => {
      return prisma.user.findFirst({
        where: { id: userId },
        select: {
          completedOnboarding: true,
          businessUrl: true,
          memberships: {
            select: {
              organizationId: true,
              role: true,
              isOwner: true
            }
          }
        }
      });
    },
    ['user-info', userId],
    { revalidate: 300, tags: [`user-info:${userId}`] }
  )();
}

const dedupedGetActiveOrganization = cache(async function () {
  // Read organization slug from the HTTP header (set by middleware for page routes)
  // or fall back to the organizationSlug cookie (sent with API route requests)
  const headerList = await headers();
  const cookieStore = await cookies();
  const organizationSlug =
    headerList.get('x-organization-slug') ??
    cookieStore.get('organizationSlug')?.value ??
    null;
  if (!organizationSlug) {
    // Instead of not-found we can just redirect.
    console.warn('No organization slug in headers. Check middleware.');
    return redirect(routes.dashboard.organizations.Index);
  }

  const organization = await cachedGetOrganizationBySlug(organizationSlug);
  if (!organization) {
    // Instead of not-found we can just redirect.
    return redirect(routes.dashboard.organizations.Index);
  }

  return organization;
});

const dedupedGetUserInfo = cache(async function (userId: string) {
  const userInfo = await cachedGetUserInfo(userId);
  if (!userInfo) {
    // Should not happen, but if it does let's sign out the user.
    // One possible scenario is if someone is fiddling with the database while a user is still logged in.
    return signOut({ redirectTo: routes.dashboard.auth.SignIn });
  }

  return userInfo;
});

export async function getAuthContext() {
  const session = await dedupedAuth();
  if (!checkSession(session)) {
    return redirect(getRedirectToSignIn());
  }

  const userInfo = await dedupedGetUserInfo(session.user.id);

  const enrichedSession = {
    ...session,
    user: {
      ...session.user,
      ...userInfo
    }
  };

  return { session: enrichedSession };
}

export async function getAuthOrganizationContext() {
  const session = await dedupedAuth();
  if (!checkSession(session)) {
    return redirect(getRedirectToSignIn());
  }

  const activeOrganization = await dedupedGetActiveOrganization();
  const userInfo = await dedupedGetUserInfo(session.user.id);
  if (
    !userInfo.memberships.some((m) => m.organizationId == activeOrganization.id)
  ) {
    // Instead of forbidden we can just redirect.
    return redirect(routes.dashboard.organizations.Index);
  }

  const enrichedSession = {
    ...session,
    user: {
      ...session.user,
      ...userInfo
    }
  };

  return { session: enrichedSession, organization: activeOrganization };
}

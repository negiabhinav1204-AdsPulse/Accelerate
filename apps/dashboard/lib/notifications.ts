/**
 * Notification helper — create platform notifications for org members.
 *
 * Usage (server-side only):
 *   await createNotification({
 *     orgId: 'uuid',
 *     type: 'campaign_failed',
 *     subject: 'Campaign failed to publish',
 *     content: '"Summer Sale" failed on Google Ads. Tap to retry.',
 *     link: '/organizations/my-org/campaigns?filter=failed',
 *   });
 *
 * Notification types:
 *   campaign_failed    — campaign push to ad platform failed
 *   campaign_published — campaign went live successfully
 *   audit_ready        — deep audit analysis completed
 *   budget_alert       — campaign pacing or budget threshold hit
 *   sync_failed        — connector data sync error
 *   optimization       — new optimization recommendation available
 *   info               — general informational
 */

import { prisma } from '@workspace/database/client';

export type NotificationType =
  | 'campaign_failed'
  | 'campaign_published'
  | 'audit_ready'
  | 'budget_alert'
  | 'sync_failed'
  | 'optimization'
  | 'info';

interface CreateNotificationInput {
  orgId: string;
  type: NotificationType;
  subject: string;
  content: string;
  /** Full path deep link — e.g. /organizations/slug/campaigns?filter=failed */
  link?: string;
  /** Restrict to specific userIds. If omitted, sends to all ADMIN + OWNER members. */
  userIds?: string[];
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const { orgId, type, subject, content, link, userIds } = input;

  let targetUserIds = userIds;

  if (!targetUserIds || targetUserIds.length === 0) {
    // Default: notify all admins and owners of the org
    const memberships = await prisma.membership.findMany({
      where: {
        organizationId: orgId,
        OR: [{ isOwner: true }, { role: 'ADMIN' }],
      },
      select: { userId: true },
    });
    targetUserIds = memberships.map((m) => m.userId);
  }

  if (targetUserIds.length === 0) return;

  await prisma.notification.createMany({
    data: targetUserIds.map((userId) => ({
      userId,
      organizationId: orgId,
      type,
      subject,
      content,
      link: link ?? null,
    })),
  });
}

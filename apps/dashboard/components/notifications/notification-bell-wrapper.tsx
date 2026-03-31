'use client';

import { useActiveOrganization } from '~/hooks/use-active-organization';
import { NotificationBell } from './notification-bell';

/**
 * Thin wrapper so NotificationBell can resolve the org slug
 * via hook inside the sidebar (which is always client-side).
 */
export function NotificationBellWrapper() {
  const org = useActiveOrganization();
  return <NotificationBell orgSlug={org.slug} />;
}

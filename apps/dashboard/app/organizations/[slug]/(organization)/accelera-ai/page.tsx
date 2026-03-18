import * as React from 'react';
import { type Metadata } from 'next';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { prisma } from '@workspace/database/client';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import { AcceleraAiHome } from '~/components/accelera-ai/accelera-ai-home';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Accelera AI')
};

export default async function AcceleraAiPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();

  // Fetch firstName for the greeting
  const userDetails = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { firstName: true, name: true }
  });

  const firstName =
    userDetails?.firstName ||
    userDetails?.name?.split(' ')[0] ||
    'there';

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">
              Accelera AI
            </h1>
          </div>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <AcceleraAiHome firstName={firstName} />
      </PageBody>
    </Page>
  );
}

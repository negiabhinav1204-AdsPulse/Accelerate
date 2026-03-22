import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SparklesIcon } from 'lucide-react';

import { getAuthOrganizationContext } from '@workspace/auth/context';
import { Button } from '@workspace/ui/components/button';
import {
  Page,
  PageBody,
  PageHeader,
  PagePrimaryBar
} from '@workspace/ui/components/page';

import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = { title: createTitle('Create Campaign') };

export default async function CreateCampaignPage(): Promise<React.JSX.Element> {
  const ctx = await getAuthOrganizationContext();

  return (
    <Page>
      <PageHeader>
        <PagePrimaryBar>
          <h1 className="text-lg font-semibold text-foreground">Create Campaign</h1>
        </PagePrimaryBar>
      </PageHeader>
      <PageBody>
        <div className="flex flex-col items-center justify-center h-full py-24 px-6 text-center">
          <div className="max-w-md space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
              <SparklesIcon className="size-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Campaign creation has moved</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered campaign creation now lives inside Accelera AI. Paste your landing page URL there and the full agent pipeline will run inline — no separate page needed.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href={`/organizations/${ctx.organization.slug}/accelera-ai`}>
                Open Accelera AI
              </Link>
            </Button>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}

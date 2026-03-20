'use client';

import * as React from 'react';
import { ZapIcon } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';

// ── Platform brand icons ──────────────────────────────────────────────────────

function GoogleIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className="size-7">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

function MetaIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-7">
      <rect width="40" height="40" rx="8" fill="#0866FF"/>
      <path
        d="M8 22.5c0 3.5 1.8 6 4.5 6 1.4 0 2.6-.6 3.8-2.2l.2-.3.2.3c1.2 1.6 2.4 2.2 3.8 2.2 1.4 0 2.6-.6 3.5-1.9.3-.4.5-.9.7-1.4.4-1.1.6-2.4.6-3.8 0-1.7-.3-3.2-.9-4.3C23.7 15.9 22.5 15 21 15c-1.4 0-2.7.8-3.9 2.5l-.6.9-.6-.9C14.7 15.8 13.4 15 12 15c-1.5 0-2.7.9-3.4 2.4-.6 1.1-.9 2.6-.9 4.3v.8z"
        fill="white"
      />
    </svg>
  );
}

function MicrosoftIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-7">
      <rect x="2" y="2" width="17" height="17" fill="#F25022"/>
      <rect x="21" y="2" width="17" height="17" fill="#7FBA00"/>
      <rect x="2" y="21" width="17" height="17" fill="#00A4EF"/>
      <rect x="21" y="21" width="17" height="17" fill="#FFB900"/>
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = {
  key: string;
  label: string;
  tagline: string;
  icon: () => React.JSX.Element;
};

const PLATFORMS: Platform[] = [
  {
    key: 'google',
    label: 'Google Ads',
    tagline: 'Search, Display & YouTube',
    icon: GoogleIcon
  },
  {
    key: 'meta',
    label: 'Meta Ads',
    tagline: 'Facebook & Instagram',
    icon: MetaIcon
  },
  {
    key: 'bing',
    label: 'Microsoft Ads',
    tagline: 'Bing & LinkedIn Audience',
    icon: MicrosoftIcon
  }
];

type ChatConnectPromptProps = {
  message: string;
  orgSlug: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatConnectPrompt({
  orgSlug
}: ChatConnectPromptProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden w-full max-w-[80%]">
      {/* Platform rows */}
      <div className="divide-y divide-border">
        {PLATFORMS.map(({ key, label, tagline, icon: Icon }) => (
          <div key={key} className="flex items-center gap-3 px-4 py-3">
            <div className="shrink-0">
              <Icon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground">{tagline}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-7 px-3 text-xs border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20 font-medium"
              onClick={() => {
                window.location.href = `/api/connectors/${key}/authorize?return=/organizations/${orgSlug}/connectors&org=${orgSlug}`;
              }}
            >
              <ZapIcon className="size-3 mr-1" />
              Connect
            </Button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-muted/40 border-t border-border">
        <a
          href={`/organizations/${orgSlug}/connectors`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all integrations →
        </a>
      </div>
    </div>
  );
}

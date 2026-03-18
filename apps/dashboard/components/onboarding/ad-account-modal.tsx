'use client';

import * as React from 'react';
import { CheckCircle2Icon, CircleIcon } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

type AdAccount = {
  id: string;
  name: string;
  accountId: string;
};

type AdAccountModalProps = {
  platform: string;
  onConfirm: (account: AdAccount) => void;
  onClose: () => void;
};

const MOCK_ACCOUNTS: AdAccount[] = [
  { id: '1', name: 'Account A', accountId: '123-456-789' },
  { id: '2', name: 'Account B', accountId: '987-654-321' },
  { id: '3', name: 'Account C', accountId: '555-000-111' }
];

export function AdAccountModal({
  platform,
  onConfirm,
  onClose
}: AdAccountModalProps): React.JSX.Element {
  const [selected, setSelected] = React.useState<string | null>(null);

  const selectedAccount = MOCK_ACCOUNTS.find((a) => a.id === selected) ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">
              Select your default {platform} ad account
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose the account to connect
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Account list */}
        <div className="px-6 py-4 space-y-2">
          {MOCK_ACCOUNTS.map((account) => {
            const isSelected = selected === account.id;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setSelected(account.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-accent'
                )}
              >
                {isSelected ? (
                  <CheckCircle2Icon className="size-5 text-primary shrink-0" />
                ) : (
                  <CircleIcon className="size-5 text-muted-foreground shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {account.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.accountId}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (selectedAccount) {
                onConfirm(selectedAccount);
              }
            }}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

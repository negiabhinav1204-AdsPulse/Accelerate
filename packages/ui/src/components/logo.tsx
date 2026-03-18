'use client';

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export type LogoElement = React.ComponentRef<'div'>;
export type LogoProps = React.ComponentPropsWithoutRef<'div'> & {
  hideSymbol?: boolean;
  hideWordmark?: boolean;
};
export function Logo({
  hideSymbol,
  hideWordmark,
  className,
  ...other
}: LogoProps): React.JSX.Element {
  return (
    <div
      className={cn('flex items-center space-x-2', className)}
      {...other}
    >
      {!hideSymbol && (
        <div className="flex size-9 items-center justify-center p-1">
          <div className="flex size-7 items-center justify-center rounded-md border text-primary-foreground bg-primary">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g>
                <path
                  d="M7.81815 8.36373L12 0L24 24H15.2809L7.81815 8.36373Z"
                  fill="currentColor"
                />
                <path
                  d="M4.32142 15.3572L8.44635 24H-1.14809e-06L4.32142 15.3572Z"
                  fill="currentColor"
                />
              </g>
            </svg>
          </div>
        </div>
      )}
      {!hideWordmark && (
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-widest">
            inmobi
          </span>
          <span className="text-base font-bold text-primary leading-tight">
            accelerate
          </span>
        </div>
      )}
    </div>
  );
}

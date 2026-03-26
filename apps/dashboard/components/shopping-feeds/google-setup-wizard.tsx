'use client';

import * as React from 'react';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  Loader2Icon,
  ShieldCheckIcon,
  XIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@workspace/ui/components/command';
import { Input } from '@workspace/ui/components/input';
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover';
import { toast } from '@workspace/ui/components/sonner';
import { cn } from '@workspace/ui/lib/utils';

import { GOOGLE_TAXONOMY } from '~/lib/google-taxonomy';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnectedAccount = { accountId: string; accountName: string } | null;

type WizardSettings = {
  titlePreference: string;
  descriptionPreference: string;
  variantPreference: string;
  appendVariantToTitle: boolean;
  inventoryPolicy: string;
  submitAdditionalImages: boolean;
  richDescriptions: boolean;
  enableSalePrice: boolean;
  enableUtmTracking: boolean;
  productIdFormat: string;
  defaultGoogleCategory: string;
  defaultAgeGroup: string;
};

const DEFAULT_SETTINGS: WizardSettings = {
  titlePreference: 'default',
  descriptionPreference: 'default',
  variantPreference: 'all',
  appendVariantToTitle: false,
  inventoryPolicy: 'ignore',
  submitAdditionalImages: false,
  richDescriptions: false,
  enableSalePrice: true,
  enableUtmTracking: true,
  productIdFormat: 'global',
  defaultGoogleCategory: '',
  defaultAgeGroup: ''
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function GoogleIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-blue-600' : 'bg-gray-200'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block size-4 rounded-full bg-white shadow ring-0 transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0'
      )} />
    </button>
  );
}

function CategoryCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const label = value ? (GOOGLE_TAXONOMY.find((t) => t.name === value)?.name ?? value) : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-xs shadow-sm hover:border-gray-300 focus:outline-none',
            !label && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{label ?? 'Search Google Product Taxonomy…'}</span>
          <ChevronsUpDownIcon className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories…" className="h-9 text-xs" />
          <CommandList className="max-h-56">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No category found.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="__clear__" onSelect={() => { onChange(''); setOpen(false); }} className="text-xs text-muted-foreground italic">
                  Clear selection
                </CommandItem>
              )}
              {GOOGLE_TAXONOMY.map((entry) => (
                <CommandItem key={entry.id} value={entry.name} onSelect={() => { onChange(entry.name); setOpen(false); }} className="text-xs">
                  <CheckIcon className={cn('mr-2 size-3.5 shrink-0', value === entry.name ? 'opacity-100' : 'opacity-0')} />
                  {entry.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Step components ───────────────────────────────────────────────────────────

// Step 1 — Connect Google Account
function Step1Connect({ googleAccount, orgSlug }: { googleAccount: ConnectedAccount; orgSlug: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center text-center py-8 max-w-md mx-auto">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 mb-6">
        <GoogleIcon />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Connect your Google Account</h2>
      <p className="text-sm text-muted-foreground mb-8">
        Connect your Google account so we can link your Shopify store to Google Merchant Center and start submitting your product feed.
      </p>

      {googleAccount ? (
        <div className="w-full rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <CheckCircle2Icon className="size-5 text-green-600 shrink-0" />
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-900">Google account connected</p>
            <p className="text-xs text-green-700 mt-0.5 truncate">{googleAccount.accountName} · ID: {googleAccount.accountId}</p>
          </div>
        </div>
      ) : (
        <div className="w-full space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
            <p className="text-xs font-medium text-amber-800 mb-1">No Google Ads account connected yet</p>
            <p className="text-xs text-amber-700">Connect your Google account first to link your Merchant Center.</p>
          </div>
          <Button
            className="w-full gap-2"
            onClick={() => { window.location.href = `/organizations/${orgSlug}/connectors`; }}
          >
            <GoogleIcon />
            Connect Google Account
            <ExternalLinkIcon className="size-3.5 ml-auto" />
          </Button>
          <p className="text-xs text-muted-foreground">You can skip this step and connect later, but your feed won't be submitted until connected.</p>
        </div>
      )}
    </div>
  );
}

// Step 2 — Enable Required Programs
function Step2Programs({ checked, setChecked }: {
  checked: Record<string, boolean>;
  setChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}): React.JSX.Element {
  const programs = [
    { key: 'shopping_ads', label: 'Shopping Ads Program', required: true, desc: 'Required to show products in Google Shopping ads. Must be enabled before feed submission.' },
    { key: 'free_listings', label: 'Free Listings Program', required: false, desc: 'Show products for free in Google Search and the Shopping tab.' },
    { key: 'product_data', label: 'Missing Product Data resolved', required: false, desc: 'Fix any product data errors in your Merchant Center dashboard.' }
  ];

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
        <AlertCircleIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900 mb-1">Enable Required Programs in Google Merchant Center</p>
          <p className="text-xs text-amber-800">
            Before submitting your feed, make sure to enable required programs in your Google Merchant Center. You must at least enable <strong>Shopping Ads</strong>, otherwise submitted feed is of no meaning because Google will never review it.
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {programs.map((prog) => (
          <button
            key={prog.key}
            type="button"
            onClick={() => setChecked((prev) => ({ ...prev, [prog.key]: !prev[prog.key] }))}
            className={cn(
              'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
              checked[prog.key] ? 'border-green-300 bg-green-50' : 'border-border hover:border-gray-300'
            )}
          >
            <div className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded border-2 mt-0.5 transition-colors',
              checked[prog.key] ? 'border-green-500 bg-green-500' : 'border-gray-300'
            )}>
              {checked[prog.key] && <CheckIcon className="size-3 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{prog.label}</p>
                {prog.required && (
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">Required</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{prog.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 shrink-0">
          <GoogleIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-900">Need help enabling programs?</p>
          <p className="text-xs text-blue-700 mt-0.5">Go to your Google Merchant Center → Growth → Manage programs</p>
        </div>
        <a
          href="https://merchants.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1 shrink-0"
        >
          Open GMC <ExternalLinkIcon className="size-3" />
        </a>
      </div>
    </div>
  );
}

// Step 3 — Domain Verification (auto-advance)
function Step3Verify({ onDone }: { onDone: () => void }): React.JSX.Element {
  const checks = [
    { label: 'Verifying domain ownership with Google Merchant Center', delay: 0 },
    { label: 'Checking shipping configuration', delay: 1800 },
    { label: 'Verifying business tax settings', delay: 3200 }
  ];
  const [done, setDone] = React.useState<boolean[]>([false, false, false]);

  React.useEffect(() => {
    const timers = checks.map((c, i) =>
      setTimeout(() => {
        setDone((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        if (i === checks.length - 1) {
          setTimeout(onDone, 800);
        }
      }, c.delay + 700)
    );
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-green-50 border border-green-100 mb-6 mx-auto">
        <ShieldCheckIcon className="size-8 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-foreground text-center mb-2">Verifying your store</h2>
      <p className="text-sm text-muted-foreground text-center mb-8">This takes just a moment…</p>

      <div className="space-y-4">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full transition-all',
              done[i] ? 'bg-green-500' : 'bg-muted'
            )}>
              {done[i]
                ? <CheckIcon className="size-3.5 text-white" />
                : <Loader2Icon className="size-3.5 text-muted-foreground animate-spin" />
              }
            </div>
            <div className="flex-1">
              <p className={cn('text-sm transition-colors', done[i] ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {check.label}
              </p>
              {done[i] && (
                <div className="mt-1 h-1 w-full rounded-full bg-green-100 overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full animate-[grow_0.4s_ease-out_forwards]" style={{ width: '100%' }} />
                </div>
              )}
            </div>
            {done[i] && <CheckCircle2Icon className="size-4 text-green-500 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Step 4 — Sync Settings From Shopify
function Step4FeedSettings({ settings, setSettings }: {
  settings: WizardSettings;
  setSettings: React.Dispatch<React.SetStateAction<WizardSettings>>;
}): React.JSX.Element {
  function set<K extends keyof WizardSettings>(key: K, value: WizardSettings[K]): void {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2">
        <CheckCircle2Icon className="size-4 text-green-600 shrink-0" />
        <p className="text-xs text-green-800 font-medium">Your Google Merchant Center has been connected successfully. Define your feed settings below.</p>
      </div>

      {/* Title preference */}
      <div className="rounded-xl border border-border p-5 space-y-5">
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">Product Title Preference</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'default', label: 'Default Product Title', desc: 'Use the product title as set in Shopify' },
              { value: 'optimized', label: 'SEO / Optimized Title', desc: 'Append brand + key attributes automatically' }
            ].map((opt) => (
              <button key={opt.value} type="button" onClick={() => set('titlePreference', opt.value)}
                className={cn('text-left p-3 rounded-lg border transition-all',
                  settings.titlePreference === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border hover:border-gray-300')}>
                <p className="text-xs font-medium">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Description preference */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">Product Description Preference</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'default', label: 'Default Description', desc: 'Use the product description from Shopify' },
              { value: 'seo', label: 'SEO Description', desc: 'Use the SEO meta description if available' }
            ].map((opt) => (
              <button key={opt.value} type="button" onClick={() => set('descriptionPreference', opt.value)}
                className={cn('text-left p-3 rounded-lg border transition-all',
                  settings.descriptionPreference === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border hover:border-gray-300')}>
                <p className="text-xs font-medium">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Variant preference */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">Product Variant Preference</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'main', label: 'First Variant Only', desc: 'Submit only the first/main variant per product' },
              { value: 'all', label: 'All Variants', desc: 'Submit every variant as a separate product in feed' }
            ].map((opt) => (
              <button key={opt.value} type="button" onClick={() => set('variantPreference', opt.value)}
                className={cn('text-left p-3 rounded-lg border transition-all',
                  settings.variantPreference === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border hover:border-gray-300')}>
                <p className="text-xs font-medium">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Toggle settings */}
        <div className="space-y-3 pt-1">
          {[
            { key: 'appendVariantToTitle' as const, label: 'Append variant name to product title', desc: 'e.g. "Blue T-Shirt – Large"' },
            { key: 'submitAdditionalImages' as const, label: 'Submit additional product images', desc: 'Include all images, not just the first one' },
            { key: 'richDescriptions' as const, label: 'Submit rich product descriptions', desc: 'Include HTML formatting from Shopify description' }
          ].map((s) => (
            <div key={s.key} className="flex items-start justify-between gap-4 py-1">
              <div>
                <p className="text-xs font-medium text-foreground">{s.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
              <Toggle checked={settings[s.key]} onChange={(v) => set(s.key, v)} />
            </div>
          ))}
        </div>

        {/* Inventory policy */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">Inventory Policy</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'follow', label: 'Follow Shopify', desc: 'Automatically exclude out-of-stock products' },
              { value: 'ignore', label: 'Ignore & Include', desc: 'Submit all products regardless of stock level' }
            ].map((opt) => (
              <button key={opt.value} type="button" onClick={() => set('inventoryPolicy', opt.value)}
                className={cn('text-left p-3 rounded-lg border transition-all',
                  settings.inventoryPolicy === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border hover:border-gray-300')}>
                <p className="text-xs font-medium">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Default settings */}
      <div className="rounded-xl border border-border p-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-foreground mb-0.5">Default Settings <span className="text-muted-foreground font-normal">(Optional)</span></h3>
          <p className="text-[11px] text-muted-foreground">Applied to all products where the attribute isn't set in Shopify.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Default Google Product Category</label>
          <CategoryCombobox value={settings.defaultGoogleCategory} onChange={(v) => set('defaultGoogleCategory', v)} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">Default Age Group</label>
          <select
            value={settings.defaultAgeGroup}
            onChange={(e) => set('defaultAgeGroup', e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs shadow-sm focus:outline-none"
          >
            <option value="">Select option</option>
            <option value="newborn">Newborn (up to 3 months)</option>
            <option value="infant">Infant (3–12 months)</option>
            <option value="toddler">Toddler (1–5 years)</option>
            <option value="kids">Kids (5–13 years)</option>
            <option value="adult">Adult</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// Step 5 — Google Sync Settings
function Step5SyncSettings({ settings, setSettings, googleAccount, storeDomain, storeCurrency }: {
  settings: WizardSettings;
  setSettings: React.Dispatch<React.SetStateAction<WizardSettings>>;
  googleAccount: ConnectedAccount;
  storeDomain: string;
  storeCurrency: string;
}): React.JSX.Element {
  function set<K extends keyof WizardSettings>(key: K, value: WizardSettings[K]): void {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="grid grid-cols-2 gap-5">
        {/* Left: Sync settings */}
        <div className="space-y-5">
          {/* Product ID Format */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="text-xs font-semibold text-foreground mb-3">Product ID Format</h3>
            <div className="space-y-2">
              {[
                { value: 'global', label: 'Global Format', desc: 'e.g. shopify_US_123456 · Common format for most stores.' },
                { value: 'sku', label: 'SKU as Product ID', desc: 'e.g. ABCD1234 · Use if you rely on Judge.me for reviews.' },
                { value: 'variant', label: 'Variant ID', desc: 'e.g. 12345678 · Also needed for Facebook Product Catalog.' }
              ].map((opt) => (
                <button key={opt.value} type="button" onClick={() => set('productIdFormat', opt.value)}
                  className={cn('w-full text-left p-3 rounded-lg border transition-all',
                    settings.productIdFormat === opt.value ? 'border-blue-500 bg-blue-50' : 'border-border hover:border-gray-300')}>
                  <div className="flex items-center gap-2">
                    <div className={cn('size-3.5 rounded-full border-2 shrink-0',
                      settings.productIdFormat === opt.value ? 'border-blue-500 bg-blue-500' : 'border-gray-300')} />
                    <p className={cn('text-xs font-medium', settings.productIdFormat === opt.value ? 'text-blue-700' : 'text-foreground')}>{opt.label}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 ml-5">{opt.desc}</p>
                </button>
              ))}
            </div>
            {settings.productIdFormat !== 'global' && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertCircleIcon className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800">Changing Product ID format after feed approval resets approval status and can take 3–5 days to re-approve.</p>
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-xs font-semibold text-foreground mb-1">Feed Options</h3>
            {[
              { key: 'enableSalePrice' as const, label: 'Include sale prices', desc: 'Show discounted prices in Shopping ads.' },
              { key: 'enableUtmTracking' as const, label: 'UTM tracking parameters', desc: 'Append utm_source=accelerate to product URLs.' }
            ].map((s) => (
              <div key={s.key} className="flex items-start justify-between gap-4 py-1">
                <div>
                  <p className="text-xs font-medium text-foreground">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
                <Toggle checked={settings[s.key]} onChange={(v) => set(s.key, v)} />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Store + GMC details */}
        <div className="space-y-5">
          <div className="rounded-xl border border-border p-5">
            <h3 className="text-xs font-semibold text-foreground mb-3">Store Details</h3>
            <div className="space-y-2.5">
              <div>
                <p className="text-[11px] text-muted-foreground">Primary Domain</p>
                <p className="text-xs font-medium text-foreground mt-0.5 break-all">{storeDomain || 'demo-store.myshopify.com'}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Store Currency</p>
                <p className="text-xs font-medium text-foreground mt-0.5">{storeCurrency || 'USD'}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Your feed will be submitted in this currency. Change from Shopify store settings.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border p-5">
            <h3 className="text-xs font-semibold text-foreground mb-3">Google Merchant Center Settings</h3>
            <div className="space-y-2.5">
              {googleAccount ? (
                <>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Google Account</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{googleAccount.accountName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Merchant ID</p>
                    <p className="text-xs font-mono font-medium text-foreground mt-0.5">{googleAccount.accountId}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Merchant Center Website</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-xs font-medium text-foreground break-all">{storeDomain || 'demo-store.myshopify.com'}</p>
                      <CheckCircle2Icon className="size-3.5 text-green-500 shrink-0" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">No Google account connected.</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Connect via the connectors page first.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border p-5">
            <h3 className="text-xs font-semibold text-foreground mb-2">Primary Target Market</h3>
            <select className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs shadow-sm focus:outline-none">
              <option>United States (English)</option>
              <option>United Kingdom (English)</option>
              <option>India (English)</option>
              <option>Australia (English)</option>
              <option>Canada (English)</option>
              <option>Germany (German)</option>
              <option>France (French)</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1.5">Your products will be published in Google Shopping for this market.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 6 — Sync Products
function Step6Sync({ orgId, onComplete }: { orgId: string; onComplete: () => void }): React.JSX.Element {
  const [phase, setPhase] = React.useState<'syncing' | 'done'>('syncing');
  const steps = [
    'Preparing your product catalog',
    'Optimizing titles and descriptions',
    'Generating Google Shopping feed',
    'Submitting to Merchant Center'
  ];
  const [activeStep, setActiveStep] = React.useState(0);

  React.useEffect(() => {
    const timers = steps.map((_, i) =>
      setTimeout(() => setActiveStep(i + 1), (i + 1) * 900)
    );
    const syncTimer = setTimeout(async () => {
      try {
        await fetch('/api/shopping-feeds/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId })
        });
      } catch { /* best effort */ }
      setPhase('done');
    }, steps.length * 900 + 400);

    return () => { timers.forEach(clearTimeout); clearTimeout(syncTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto py-8 text-center">
      {phase === 'syncing' ? (
        <>
          <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 mb-6 mx-auto">
            <Loader2Icon className="size-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Syncing your products</h2>
          <p className="text-sm text-muted-foreground mb-8">Submitting your catalog to Google Merchant Center…</p>
          <div className="space-y-3 text-left">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full transition-all',
                  i < activeStep ? 'bg-green-500' : i === activeStep ? 'bg-blue-500' : 'bg-muted'
                )}>
                  {i < activeStep
                    ? <CheckIcon className="size-3.5 text-white" />
                    : i === activeStep
                      ? <Loader2Icon className="size-3 text-white animate-spin" />
                      : null
                  }
                </div>
                <p className={cn('text-sm transition-colors',
                  i < activeStep ? 'text-foreground font-medium' : i === activeStep ? 'text-blue-600 font-medium' : 'text-muted-foreground'
                )}>{step}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex size-16 items-center justify-center rounded-2xl bg-green-50 border border-green-100 mb-6 mx-auto">
            <CheckCircle2Icon className="size-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">You're all set!</h2>
          <p className="text-sm text-muted-foreground mb-2">Your product feed has been submitted to Google Merchant Center.</p>
          <p className="text-xs text-muted-foreground mb-8">Google typically reviews feeds within <strong>10–24 hours</strong>. Check back soon to see approval status.</p>
          <Button onClick={onComplete} className="gap-2 w-full">
            Go to Shopping Feed
            <ArrowRightIcon className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Connect Google',
  'Enable Programs',
  'Verify Domain',
  'Feed Settings',
  'Sync Settings',
  'Sync Products'
];

export function GoogleSetupWizard({
  open,
  onClose,
  orgId,
  orgSlug,
  googleAccount,
  storeDomain,
  storeCurrency,
  initialSettings
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgSlug: string;
  googleAccount: ConnectedAccount;
  storeDomain: string;
  storeCurrency: string;
  initialSettings?: Partial<WizardSettings>;
}): React.JSX.Element | null {
  const [step, setStep] = React.useState(0);
  const [programsChecked, setProgramsChecked] = React.useState<Record<string, boolean>>({
    shopping_ads: false, free_listings: false, product_data: false
  });
  const [settings, setSettings] = React.useState<WizardSettings>({ ...DEFAULT_SETTINGS, ...initialSettings });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) { setStep(0); setProgramsChecked({ shopping_ads: false, free_listings: false, product_data: false }); }
  }, [open]);

  if (!open) return null;

  const isLastStep = step === STEP_LABELS.length - 1;
  const canAdvanceStep2 = step !== 1 || programsChecked.shopping_ads;

  async function saveSettings(): Promise<void> {
    setSaving(true);
    try {
      await fetch('/api/shopping-feeds/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          channels: ['google', 'meta', 'microsoft'],
          titlePreference: settings.titlePreference,
          descriptionPreference: settings.descriptionPreference,
          variantPreference: settings.variantPreference,
          appendVariantToTitle: settings.appendVariantToTitle,
          inventoryPolicy: settings.inventoryPolicy,
          submitAdditionalImages: settings.submitAdditionalImages,
          richDescriptions: settings.richDescriptions,
          enableSalePrice: settings.enableSalePrice,
          enableUtmTracking: settings.enableUtmTracking,
          productIdFormat: settings.productIdFormat,
          defaultGoogleCategory: settings.defaultGoogleCategory || null,
          defaultAgeGroup: settings.defaultAgeGroup || null
        })
      });
    } catch {
      toast.error('Failed to save settings, but you can update them in Feed Settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleNext(): Promise<void> {
    if (step === 4) await saveSettings();
    setStep((s) => s + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50">
            <GoogleIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Google Shopping Setup</p>
            <p className="text-xs text-muted-foreground">Step {step + 1} of {STEP_LABELS.length}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-muted">
          <XIcon className="size-5" />
        </button>
      </div>

      {/* Progress */}
      <div className="px-6 pt-4 pb-0 shrink-0">
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-all',
                  i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                )}>
                  {i < step ? <CheckIcon className="size-3.5" /> : i + 1}
                </div>
                <span className={cn('text-[10px] font-medium whitespace-nowrap hidden sm:block',
                  i === step ? 'text-blue-600' : i < step ? 'text-green-600' : 'text-muted-foreground'
                )}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={cn('flex-1 h-0.5 mb-4 rounded-full transition-colors', i < step ? 'bg-green-500' : 'bg-muted')} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {step === 0 && <Step1Connect googleAccount={googleAccount} orgSlug={orgSlug} />}
        {step === 1 && <Step2Programs checked={programsChecked} setChecked={setProgramsChecked} />}
        {step === 2 && <Step3Verify onDone={() => setStep(3)} />}
        {step === 3 && <Step4FeedSettings settings={settings} setSettings={setSettings} />}
        {step === 4 && (
          <Step5SyncSettings
            settings={settings}
            setSettings={setSettings}
            googleAccount={googleAccount}
            storeDomain={storeDomain}
            storeCurrency={storeCurrency}
          />
        )}
        {step === 5 && <Step6Sync orgId={orgId} onComplete={onClose} />}
      </div>

      {/* Footer nav — hidden on step 2 (auto-advance) and step 5 (has own CTA) */}
      {step !== 2 && step !== 5 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => step === 0 ? onClose() : setStep((s) => s - 1)}
            className="gap-1.5"
          >
            <ArrowLeftIcon className="size-3.5" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {!isLastStep && (
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canAdvanceStep2 || saving}
              className="gap-1.5"
            >
              {saving && <Loader2Icon className="size-3.5 animate-spin" />}
              {step === 4 ? 'Save & Continue' : 'Continue'}
              <ArrowRightIcon className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

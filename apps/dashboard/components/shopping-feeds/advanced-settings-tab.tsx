'use client';

import * as React from 'react';
import {
  BuildingIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LinkIcon,
  Loader2Icon,
  MapPinIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
  TruckIcon,
  XIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { toast } from '@workspace/ui/components/sonner';
import { cn } from '@workspace/ui/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreHours = {
  monday:    { open: string; close: string; closed: boolean };
  tuesday:   { open: string; close: string; closed: boolean };
  wednesday: { open: string; close: string; closed: boolean };
  thursday:  { open: string; close: string; closed: boolean };
  friday:    { open: string; close: string; closed: boolean };
  saturday:  { open: string; close: string; closed: boolean };
  sunday:    { open: string; close: string; closed: boolean };
};

type StoreLocation = {
  id: string;
  storeCode: string;
  name: string;
  address: string;
  city: string;
  state: string | null;
  country: string;
  postalCode: string;
  phone: string | null;
  hours: StoreHours;
  isActive: boolean;
};

type ShopifyMarket = {
  id: string;
  marketName: string;
  targetCountry: string;
  language: string;
  currency: string;
  isEnabled: boolean;
  feedUrl: string;
};

type DeliveryRule = {
  id: string;
  countryCode: string;
  carrier: string;
  service: string;
  minTransitDays: number;
  maxTransitDays: number;
  cutoffHour: number;
  price: number | null;
  isActive: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;

const DEFAULT_HOURS: StoreHours = {
  monday:    { open: '09:00', close: '18:00', closed: false },
  tuesday:   { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday:  { open: '09:00', close: '18:00', closed: false },
  friday:    { open: '09:00', close: '18:00', closed: false },
  saturday:  { open: '10:00', close: '16:00', closed: false },
  sunday:    { open: '10:00', close: '16:00', closed: true }
};

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
        enabled ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  );
}

function SectionHeader({
  icon, title, description, expanded, onToggle
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  expanded: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 text-left"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronDownIcon className={cn('size-4 text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')} />
    </button>
  );
}

// ── Buy on Google ─────────────────────────────────────────────────────────────

function BuyOnGoogleSection({
  orgId, enabled, onChange
}: {
  orgId: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element {
  const [saving, setSaving] = React.useState(false);

  async function toggle(v: boolean): Promise<void> {
    setSaving(true);
    try {
      await fetch('/api/shopping-feeds/advanced-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, buyOnGoogleEnabled: v })
      });
      onChange(v);
      toast.success(v ? 'Buy on Google enabled' : 'Buy on Google disabled');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Enable Buy on Google</p>
          <p className="text-xs text-muted-foreground mt-0.5">Let customers checkout directly on Google without visiting your store.</p>
        </div>
        {saving ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : (
          <Toggle enabled={enabled} onChange={(v) => { void toggle(v); }} />
        )}
      </div>
      {enabled && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <ExternalLinkIcon className="size-4 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-800">Configure return policies, shipping, and pricing in Google Merchant Center.</p>
          </div>
          <a
            href="https://merchants.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs font-medium text-blue-700 underline hover:text-blue-900"
          >
            Open GMC →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Local Inventory ────────────────────────────────────────────────────────────

function LocationModal({
  open, onClose, orgId, editLocation, onSaved
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editLocation: StoreLocation | null;
  onSaved: (loc: StoreLocation, isNew: boolean) => void;
}): React.JSX.Element | null {
  const [form, setForm] = React.useState({
    storeCode: '', name: '', address: '', city: '', state: '', country: 'US', postalCode: '', phone: '',
    hours: DEFAULT_HOURS
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editLocation) {
      setForm({
        storeCode: editLocation.storeCode,
        name: editLocation.name,
        address: editLocation.address,
        city: editLocation.city,
        state: editLocation.state ?? '',
        country: editLocation.country,
        postalCode: editLocation.postalCode,
        phone: editLocation.phone ?? '',
        hours: editLocation.hours
      });
    } else {
      setForm({ storeCode: '', name: '', address: '', city: '', state: '', country: 'US', postalCode: '', phone: '', hours: DEFAULT_HOURS });
    }
  }, [open, editLocation]);

  if (!open) return null;

  async function handleSave(): Promise<void> {
    if (!form.storeCode || !form.name || !form.address || !form.city || !form.country || !form.postalCode) {
      toast.error('Fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      const payload = { orgId, ...form, state: form.state || undefined, phone: form.phone || undefined };
      const url = editLocation ? `/api/shopping-feeds/locations/${editLocation.id}` : '/api/shopping-feeds/locations';
      const method = editLocation ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { location: StoreLocation };
      toast.success(editLocation ? 'Location updated' : 'Location added');
      onSaved(data.location, !editLocation);
      onClose();
    } catch {
      toast.error('Failed to save location');
    } finally {
      setSaving(false);
    }
  }

  function updateHour(day: keyof StoreHours, field: 'open' | 'close' | 'closed', value: string | boolean): void {
    setForm((f) => ({ ...f, hours: { ...f.hours, [day]: { ...f.hours[day], [field]: value } } }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background">
          <h2 className="text-base font-semibold text-foreground">{editLocation ? 'Edit Location' : 'Add Store Location'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="size-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* Store details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Store code <span className="text-red-500">*</span></label>
              <Input placeholder="e.g. STORE-001" value={form.storeCode} onChange={(e) => setForm((f) => ({ ...f, storeCode: e.target.value }))} />
              <p className="text-[10px] text-muted-foreground mt-1">Unique identifier used in Google Local Inventory</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Store name <span className="text-red-500">*</span></label>
              <Input placeholder="e.g. Downtown Mumbai Store" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Street address <span className="text-red-500">*</span></label>
            <Input placeholder="123 Main Street, Suite 4" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">City <span className="text-red-500">*</span></label>
              <Input placeholder="Mumbai" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">State / Province</label>
              <Input placeholder="Maharashtra" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Country code <span className="text-red-500">*</span></label>
              <Input placeholder="IN" maxLength={2} value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Postal code <span className="text-red-500">*</span></label>
              <Input placeholder="400001" value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
              <Input placeholder="+91 22 1234 5678" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>

          {/* Store hours */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-3">Store hours</p>
            <div className="space-y-2">
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-medium text-foreground capitalize">{day}</span>
                  <Toggle enabled={!form.hours[day].closed} onChange={(v) => updateHour(day, 'closed', !v)} />
                  {form.hours[day].closed ? (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input type="time" value={form.hours[day].open} onChange={(e) => updateHour(day, 'open', e.target.value)} className="w-28 text-xs" />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input type="time" value={form.hours[day].close} onChange={(e) => updateHour(day, 'close', e.target.value)} className="w-28 text-xs" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-background">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2Icon className="size-3.5 animate-spin" />}
            {editLocation ? 'Save Changes' : 'Add Location'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LocalInventorySection({ orgId, enabled, onChange }: { orgId: string; enabled: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  const [locations, setLocations] = React.useState<StoreLocation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editLoc, setEditLoc] = React.useState<StoreLocation | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/locations?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d) => { const data = d as { locations: StoreLocation[] }; setLocations(data.locations ?? []); })
      .finally(() => setLoading(false));
  }, [orgId]);

  async function toggleEnabled(v: boolean): Promise<void> {
    setSaving(true);
    try {
      await fetch('/api/shopping-feeds/advanced-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId, localInventoryEnabled: v }) });
      onChange(v);
      toast.success(v ? 'Local Inventory Ads enabled' : 'Local Inventory Ads disabled');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string): Promise<void> {
    const prev = locations;
    setLocations((l) => l.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/shopping-feeds/locations/${id}?orgId=${orgId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Location removed');
    } catch { setLocations(prev); toast.error('Failed to delete'); }
  }

  function handleSaved(loc: StoreLocation, isNew: boolean): void {
    if (isNew) setLocations((l) => [...l, loc]);
    else setLocations((l) => l.map((x) => x.id === loc.id ? loc : x));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Enable Local Inventory Ads</p>
          <p className="text-xs text-muted-foreground mt-0.5">Show in-store availability on Google Shopping for nearby shoppers.</p>
        </div>
        {saving ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : (
          <Toggle enabled={enabled} onChange={(v) => { void toggleEnabled(v); }} />
        )}
      </div>

      {enabled && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Store Locations <span className="text-muted-foreground font-normal">({locations.length})</span></p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditLoc(null); setDialogOpen(true); }}>
              <PlusIcon className="size-3.5" />
              Add Location
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2Icon className="size-5 animate-spin text-muted-foreground" /></div>
          ) : locations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <MapPinIcon className="size-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">No store locations yet</p>
              <p className="text-xs text-muted-foreground mb-4">Add your physical store locations to enable Local Inventory Ads.</p>
              <Button size="sm" onClick={() => { setEditLoc(null); setDialogOpen(true); }} className="gap-1.5">
                <PlusIcon className="size-3.5" />Add First Location
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map((loc) => (
                <div key={loc.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 shrink-0">
                    <MapPinIcon className="size-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{loc.name}</p>
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{loc.storeCode}</span>
                      <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5 border', loc.isActive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500')}>
                        {loc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{loc.address}, {loc.city}{loc.state ? `, ${loc.state}` : ''} {loc.postalCode} · {loc.country}</p>
                    {loc.phone && <p className="text-xs text-muted-foreground">{loc.phone}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {DAYS.filter((d) => !loc.hours[d].closed).map((d) => `${d.slice(0,3)}: ${loc.hours[d].open}–${loc.hours[d].close}`).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => { setEditLoc(loc); setDialogOpen(true); }} className="text-xs text-primary hover:underline font-medium">Edit</button>
                    <span className="text-muted-foreground">·</span>
                    <button type="button" onClick={() => { void handleDelete(loc.id); }} className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <LocationModal open={dialogOpen} onClose={() => setDialogOpen(false)} orgId={orgId} editLocation={editLoc} onSaved={handleSaved} />
    </div>
  );
}

// ── XML Feed ───────────────────────────────────────────────────────────────────

function XmlFeedSection({ orgId }: { orgId: string }): React.JSX.Element {
  const baseFeedUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://accelerate-dashboard-sable.vercel.app'}/api/shopping-feeds/xml?orgId=${orgId}`;

  const CHANNELS = [
    { id: 'google', label: 'Google Shopping', url: `${baseFeedUrl}&channel=google` },
    { id: 'meta', label: 'Meta Catalog', url: `${baseFeedUrl}&channel=meta` },
    { id: 'microsoft', label: 'Microsoft Shopping', url: `${baseFeedUrl}&channel=microsoft` }
  ];

  function copy(url: string): void {
    void navigator.clipboard.writeText(url);
    toast.success('Feed URL copied');
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Live XML feed endpoints automatically updated on every product sync. Submit these URLs directly to your ad platform's Merchant Center.
      </p>

      <div className="space-y-2">
        {CHANNELS.map((ch) => (
          <div key={ch.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">{ch.label}</p>
              <div className="flex items-center gap-2">
                <a href={ch.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLinkIcon className="size-3" />Preview
                </a>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs px-2" onClick={() => copy(ch.url)}>
                  <ClipboardIcon className="size-3" />Copy URL
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5">
              <LinkIcon className="size-3 text-muted-foreground shrink-0" />
              <code className="text-[11px] text-muted-foreground truncate font-mono">{ch.url}</code>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs font-medium text-blue-800 mb-1">How to submit to Google Merchant Center</p>
        <ol className="text-xs text-blue-700 space-y-0.5 list-decimal list-inside">
          <li>Copy the Google Shopping URL above</li>
          <li>In GMC, go to Products → Feeds → Add Feed</li>
          <li>Select "Scheduled Fetch" and paste the URL</li>
          <li>Set fetch frequency to Daily</li>
        </ol>
      </div>
    </div>
  );
}

// ── Shopify Markets ────────────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States', currency: 'USD', lang: 'en' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP', lang: 'en' },
  { code: 'IN', label: 'India', currency: 'INR', lang: 'en' },
  { code: 'AU', label: 'Australia', currency: 'AUD', lang: 'en' },
  { code: 'CA', label: 'Canada', currency: 'CAD', lang: 'en' },
  { code: 'DE', label: 'Germany', currency: 'EUR', lang: 'de' },
  { code: 'FR', label: 'France', currency: 'EUR', lang: 'fr' },
  { code: 'JP', label: 'Japan', currency: 'JPY', lang: 'ja' },
  { code: 'BR', label: 'Brazil', currency: 'BRL', lang: 'pt' },
  { code: 'MX', label: 'Mexico', currency: 'MXN', lang: 'es' },
  { code: 'AE', label: 'UAE', currency: 'AED', lang: 'ar' },
  { code: 'SG', label: 'Singapore', currency: 'SGD', lang: 'en' }
];

function MarketModal({ open, onClose, orgId, editMarket, onSaved }: {
  open: boolean; onClose: () => void; orgId: string;
  editMarket: ShopifyMarket | null; onSaved: (m: ShopifyMarket, isNew: boolean) => void;
}): React.JSX.Element | null {
  const [form, setForm] = React.useState({ marketName: '', targetCountry: 'US', language: 'en', currency: 'USD' });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editMarket) {
      setForm({ marketName: editMarket.marketName, targetCountry: editMarket.targetCountry, language: editMarket.language, currency: editMarket.currency });
    } else {
      setForm({ marketName: '', targetCountry: 'US', language: 'en', currency: 'USD' });
    }
  }, [open, editMarket]);

  if (!open) return null;

  function onCountryChange(code: string): void {
    const opt = COUNTRY_OPTIONS.find((c) => c.code === code);
    if (opt) setForm((f) => ({ ...f, targetCountry: code, currency: opt.currency, language: opt.lang }));
    else setForm((f) => ({ ...f, targetCountry: code }));
  }

  async function handleSave(): Promise<void> {
    if (!form.marketName || !form.targetCountry || !form.language || !form.currency) {
      toast.error('All fields required'); return;
    }
    setSaving(true);
    try {
      const url = editMarket ? `/api/shopping-feeds/markets/${editMarket.id}` : '/api/shopping-feeds/markets';
      const method = editMarket ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId, ...form }) });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { market: ShopifyMarket };
      toast.success(editMarket ? 'Market updated' : 'Market added');
      onSaved(data.market, !editMarket);
      onClose();
    } catch { toast.error('Failed to save market'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{editMarket ? 'Edit Market' : 'Add Market'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="size-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Market name</label>
            <Input placeholder="e.g. European Market" value={form.marketName} onChange={(e) => setForm((f) => ({ ...f, marketName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Target country</label>
            <select
              value={form.targetCountry}
              onChange={(e) => onCountryChange(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Language</label>
              <Input placeholder="en" maxLength={5} value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value.toLowerCase() }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Currency</label>
              <Input placeholder="USD" maxLength={3} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2Icon className="size-3.5 animate-spin" />}
            {editMarket ? 'Save Changes' : 'Add Market'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShopifyMarketsSection({ orgId }: { orgId: string }): React.JSX.Element {
  const [markets, setMarkets] = React.useState<ShopifyMarket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editMarket, setEditMarket] = React.useState<ShopifyMarket | null>(null);

  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/markets?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d) => { const data = d as { markets: ShopifyMarket[] }; setMarkets(data.markets ?? []); })
      .finally(() => setLoading(false));
  }, [orgId]);

  async function handleDelete(id: string): Promise<void> {
    const prev = markets;
    setMarkets((m) => m.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/shopping-feeds/markets/${id}?orgId=${orgId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Market removed');
    } catch { setMarkets(prev); toast.error('Failed to delete'); }
  }

  async function toggleEnabled(market: ShopifyMarket): Promise<void> {
    const updated = { ...market, isEnabled: !market.isEnabled };
    setMarkets((m) => m.map((x) => x.id === market.id ? updated : x));
    try {
      await fetch(`/api/shopping-feeds/markets/${market.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId, isEnabled: updated.isEnabled }) });
    } catch {
      setMarkets((m) => m.map((x) => x.id === market.id ? market : x));
      toast.error('Failed to update');
    }
  }

  function handleSaved(m: ShopifyMarket, isNew: boolean): void {
    if (isNew) setMarkets((prev) => [...prev, m]);
    else setMarkets((prev) => prev.map((x) => x.id === m.id ? m : x));
  }

  function copyUrl(url: string): void { void navigator.clipboard.writeText(url); toast.success('Feed URL copied'); }

  if (loading) return <div className="flex justify-center py-8"><Loader2Icon className="size-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Each market gets a unique feed URL with localized currency and language settings.</p>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => { setEditMarket(null); setDialogOpen(true); }}>
          <PlusIcon className="size-3.5" />Add Market
        </Button>
      </div>

      {markets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <GlobeIcon className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">No markets configured</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">Add markets to generate separate feed URLs per region with localized pricing and language.</p>
          <Button size="sm" onClick={() => { setEditMarket(null); setDialogOpen(true); }} className="gap-1.5">
            <PlusIcon className="size-3.5" />Add First Market
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {markets.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-purple-50 shrink-0">
                  <GlobeIcon className="size-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-foreground">{m.marketName}</p>
                    <span className="text-xs text-muted-foreground">{m.targetCountry} · {m.currency} · {m.language}</span>
                    <Toggle enabled={m.isEnabled} onChange={() => { void toggleEnabled(m); }} />
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1">
                    <LinkIcon className="size-3 text-muted-foreground shrink-0" />
                    <code className="text-[10px] text-muted-foreground truncate font-mono flex-1">{m.feedUrl}</code>
                    <button type="button" onClick={() => copyUrl(m.feedUrl)} className="shrink-0 text-muted-foreground hover:text-foreground">
                      <ClipboardIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => { setEditMarket(m); setDialogOpen(true); }} className="text-xs text-primary hover:underline font-medium">Edit</button>
                  <span className="text-muted-foreground">·</span>
                  <button type="button" onClick={() => { void handleDelete(m.id); }} className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MarketModal open={dialogOpen} onClose={() => setDialogOpen(false)} orgId={orgId} editMarket={editMarket} onSaved={handleSaved} />
    </div>
  );
}

// ── Delivery Speed Estimates ───────────────────────────────────────────────────

const CARRIERS = ['UPS', 'FedEx', 'USPS', 'DHL', 'Royal Mail', 'Canada Post', 'Australia Post', 'India Post', 'Other'];

function DeliveryRuleModal({ open, onClose, orgId, editRule, onSaved }: {
  open: boolean; onClose: () => void; orgId: string;
  editRule: DeliveryRule | null; onSaved: (r: DeliveryRule, isNew: boolean) => void;
}): React.JSX.Element | null {
  const [form, setForm] = React.useState({
    countryCode: 'US', carrier: 'UPS', service: 'Ground',
    minTransitDays: '2', maxTransitDays: '5', cutoffHour: '17', price: ''
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editRule) {
      setForm({
        countryCode: editRule.countryCode, carrier: editRule.carrier, service: editRule.service,
        minTransitDays: String(editRule.minTransitDays), maxTransitDays: String(editRule.maxTransitDays),
        cutoffHour: String(editRule.cutoffHour), price: editRule.price != null ? String(editRule.price) : ''
      });
    } else {
      setForm({ countryCode: 'US', carrier: 'UPS', service: 'Ground', minTransitDays: '2', maxTransitDays: '5', cutoffHour: '17', price: '' });
    }
  }, [open, editRule]);

  if (!open) return null;

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const payload = {
        orgId, countryCode: form.countryCode, carrier: form.carrier, service: form.service,
        minTransitDays: parseInt(form.minTransitDays), maxTransitDays: parseInt(form.maxTransitDays),
        cutoffHour: parseInt(form.cutoffHour), price: form.price ? parseFloat(form.price) : null
      };
      const url = editRule ? `/api/shopping-feeds/delivery-rules/${editRule.id}` : '/api/shopping-feeds/delivery-rules';
      const method = editRule ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { rule: DeliveryRule };
      toast.success(editRule ? 'Rule updated' : 'Rule added');
      onSaved(data.rule, !editRule);
      onClose();
    } catch { toast.error('Failed to save rule'); }
    finally { setSaving(false); }
  }

  const countryName = COUNTRY_OPTIONS.find((c) => c.code === form.countryCode)?.label ?? form.countryCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{editRule ? 'Edit Shipping Rule' : 'Add Shipping Rule'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="size-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Country</label>
            <select
              value={form.countryCode}
              onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}
              <option value="*">All countries (*)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Carrier</label>
              <select
                value={form.carrier}
                onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {CARRIERS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Service</label>
              <Input placeholder="e.g. Ground, Express" value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Min days</label>
              <Input type="number" min="0" value={form.minTransitDays} onChange={(e) => setForm((f) => ({ ...f, minTransitDays: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max days</label>
              <Input type="number" min="0" value={form.maxTransitDays} onChange={(e) => setForm((f) => ({ ...f, maxTransitDays: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cutoff hour</label>
              <Input type="number" min="0" max="23" value={form.cutoffHour} onChange={(e) => setForm((f) => ({ ...f, cutoffHour: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Shipping price (USD) — leave blank for free</label>
            <div className="flex">
              <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-input bg-muted text-sm text-muted-foreground">$</span>
              <Input type="number" min="0" step="0.01" placeholder="0.00 (free)" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="rounded-l-none" />
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p>Rule summary: <span className="text-foreground font-medium">{form.carrier} {form.service}</span> to <span className="text-foreground font-medium">{countryName}</span> in <span className="text-foreground font-medium">{form.minTransitDays}–{form.maxTransitDays} days</span> (cutoff {form.cutoffHour}:00), {form.price ? `$${form.price}` : 'free shipping'}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2Icon className="size-3.5 animate-spin" />}
            {editRule ? 'Save Changes' : 'Add Rule'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeliverySpeedSection({ orgId }: { orgId: string }): React.JSX.Element {
  const [rules, setRules] = React.useState<DeliveryRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editRule, setEditRule] = React.useState<DeliveryRule | null>(null);

  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/delivery-rules?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d) => { const data = d as { rules: DeliveryRule[] }; setRules(data.rules ?? []); })
      .finally(() => setLoading(false));
  }, [orgId]);

  async function handleDelete(id: string): Promise<void> {
    const prev = rules;
    setRules((r) => r.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/shopping-feeds/delivery-rules/${id}?orgId=${orgId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Rule removed');
    } catch { setRules(prev); toast.error('Failed to delete'); }
  }

  async function toggleActive(rule: DeliveryRule): Promise<void> {
    const updated = { ...rule, isActive: !rule.isActive };
    setRules((r) => r.map((x) => x.id === rule.id ? updated : x));
    try {
      await fetch(`/api/shopping-feeds/delivery-rules/${rule.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId, isActive: updated.isActive }) });
    } catch {
      setRules((r) => r.map((x) => x.id === rule.id ? rule : x));
      toast.error('Failed to update');
    }
  }

  function handleSaved(r: DeliveryRule, isNew: boolean): void {
    if (isNew) setRules((prev) => [...prev, r]);
    else setRules((prev) => prev.map((x) => x.id === r.id ? r : x));
  }

  // Group by country
  const byCountry = React.useMemo(() => {
    const map = new Map<string, DeliveryRule[]>();
    for (const r of rules) {
      const arr = map.get(r.countryCode) ?? [];
      arr.push(r);
      map.set(r.countryCode, arr);
    }
    return map;
  }, [rules]);

  if (loading) return <div className="flex justify-center py-8"><Loader2Icon className="size-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Configure per-country shipping carrier rules to enable Google-Calculated Delivery Speed Estimates.</p>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => { setEditRule(null); setDialogOpen(true); }}>
          <PlusIcon className="size-3.5" />Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <TruckIcon className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">No shipping rules yet</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">Add per-country carrier rules to show accurate delivery speed estimates on Google Shopping.</p>
          <Button size="sm" onClick={() => { setEditRule(null); setDialogOpen(true); }} className="gap-1.5">
            <PlusIcon className="size-3.5" />Add First Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(byCountry.entries()).map(([country, countryRules]) => {
            const countryLabel = COUNTRY_OPTIONS.find((c) => c.code === country)?.label ?? country;
            return (
              <div key={country} className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 bg-muted/50 px-4 py-2.5 border-b border-border">
                  <GlobeIcon className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">{countryLabel} ({country})</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{countryRules.length} rule{countryRules.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-border">
                  {countryRules.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <TruckIcon className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{r.carrier} — {r.service}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.minTransitDays}–{r.maxTransitDays} days · cutoff {r.cutoffHour}:00 · {r.price != null ? `$${Number(r.price).toFixed(2)}` : 'Free'}
                        </p>
                      </div>
                      <Toggle enabled={r.isActive} onChange={() => { void toggleActive(r); }} />
                      <button type="button" onClick={() => { setEditRule(r); setDialogOpen(true); }} className="text-xs text-primary hover:underline font-medium shrink-0">Edit</button>
                      <button type="button" onClick={() => { void handleDelete(r.id); }} className="text-muted-foreground hover:text-red-500 shrink-0">
                        <TrashIcon className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeliveryRuleModal open={dialogOpen} onClose={() => setDialogOpen(false)} orgId={orgId} editRule={editRule} onSaved={handleSaved} />
    </div>
  );
}

// ── Main Advanced Settings Tab ─────────────────────────────────────────────────

type Section = 'buyongoogle' | 'local' | 'xml' | 'markets' | 'delivery';

export function AdvancedSettingsTab({ orgId }: { orgId: string }): React.JSX.Element {
  const [expanded, setExpanded] = React.useState<Section | null>('xml');
  const [buyOnGoogleEnabled, setBuyOnGoogleEnabled] = React.useState(false);
  const [localInventoryEnabled, setLocalInventoryEnabled] = React.useState(false);
  const [loadingSettings, setLoadingSettings] = React.useState(true);

  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/advanced-settings?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d) => {
        const data = d as { buyOnGoogleEnabled: boolean; localInventoryEnabled: boolean };
        setBuyOnGoogleEnabled(data.buyOnGoogleEnabled);
        setLocalInventoryEnabled(data.localInventoryEnabled);
      })
      .finally(() => setLoadingSettings(false));
  }, [orgId]);

  function toggle(s: Section): void {
    setExpanded((prev) => prev === s ? null : s);
  }

  const SECTIONS: { id: Section; icon: React.ReactNode; title: string; description: string; badge?: string }[] = [
    {
      id: 'buyongoogle',
      icon: <ShoppingCartIcon className="size-4" />,
      title: 'Buy on Google',
      description: 'Let customers check out directly on Google without leaving the SERP.',
      badge: buyOnGoogleEnabled ? 'Enabled' : undefined
    },
    {
      id: 'local',
      icon: <MapPinIcon className="size-4" />,
      title: 'Local Inventory Ads',
      description: 'Show in-store product availability on Google Shopping to nearby shoppers.',
      badge: localInventoryEnabled ? 'Enabled' : undefined
    },
    {
      id: 'xml',
      icon: <LinkIcon className="size-4" />,
      title: 'XML Feed URLs',
      description: 'Live Google Merchant XML feed endpoints for all channels — ready to submit.'
    },
    {
      id: 'markets',
      icon: <GlobeIcon className="size-4" />,
      title: 'Shopify Markets Feed',
      description: 'Generate separate feed URLs per market with localized currency, language, and pricing.'
    },
    {
      id: 'delivery',
      icon: <TruckIcon className="size-4" />,
      title: 'Delivery Speed Estimates',
      description: 'Configure per-country carrier shipping rules for Google-Calculated delivery times.'
    }
  ];

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      {SECTIONS.map((section) => (
        <div key={section.id} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-center gap-3">
              <SectionHeader
                icon={section.icon}
                title={section.title}
                description={section.description}
                expanded={expanded === section.id}
                onToggle={() => toggle(section.id)}
              />
              {section.badge && (
                <span className="shrink-0 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 flex items-center gap-1">
                  <CheckCircle2Icon className="size-3" />{section.badge}
                </span>
              )}
            </div>
          </div>

          {expanded === section.id && (
            <div className="border-t border-border px-5 py-5">
              {section.id === 'buyongoogle' && (
                <BuyOnGoogleSection orgId={orgId} enabled={buyOnGoogleEnabled} onChange={setBuyOnGoogleEnabled} />
              )}
              {section.id === 'local' && (
                <LocalInventorySection orgId={orgId} enabled={localInventoryEnabled} onChange={setLocalInventoryEnabled} />
              )}
              {section.id === 'xml' && <XmlFeedSection orgId={orgId} />}
              {section.id === 'markets' && <ShopifyMarketsSection orgId={orgId} />}
              {section.id === 'delivery' && <DeliverySpeedSection orgId={orgId} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

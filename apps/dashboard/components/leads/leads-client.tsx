'use client';

import * as React from 'react';
import {
  ClipboardListIcon,
  CopyIcon,
  PlusIcon,
  TrashIcon,
  TrendingUpIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent } from '@workspace/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { Textarea } from '@workspace/ui/components/textarea';
import { toast } from '@workspace/ui/components/sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HostingType = 'own_domain' | 'typeform' | 'hubspot' | 'shopify';

interface LeadForm {
  id: string;
  title: string;
  description: string;
  hosting_type: HostingType;
  is_active: boolean;
  submission_count: number;
  conversion_rate: number;
  published_url: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Mock data — TODO: replace with real API call
// ---------------------------------------------------------------------------

const MOCK_FORMS: LeadForm[] = [
  {
    id: '1',
    title: 'Summer Sale Sign-Up',
    description: 'Get 20% off your first order',
    hosting_type: 'own_domain',
    is_active: true,
    submission_count: 342,
    conversion_rate: 5.1,
    published_url: 'https://app.accelerate.inmobi.com/forms/1',
    created_at: '2026-03-01',
  },
  {
    id: '2',
    title: 'Product Launch Waitlist',
    description: 'Be first to know about our new collection',
    hosting_type: 'typeform',
    is_active: true,
    submission_count: 289,
    conversion_rate: 3.8,
    published_url: 'https://forms.typeform.com/to/abc123',
    created_at: '2026-03-10',
  },
  {
    id: '3',
    title: 'Newsletter Signup',
    description: '',
    hosting_type: 'own_domain',
    is_active: false,
    submission_count: 216,
    conversion_rate: 2.1,
    published_url: null,
    created_at: '2026-03-15',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hostingLabel(type: HostingType): string {
  const map: Record<HostingType, string> = {
    own_domain: 'Hosted',
    typeform: 'Typeform',
    hubspot: 'HubSpot',
    shopify: 'Shopify',
  };
  return map[type];
}

function hostingBadgeClass(type: HostingType): string {
  const map: Record<HostingType, string> = {
    own_domain: 'bg-blue-100 text-blue-700 border-blue-200',
    typeform: 'bg-purple-100 text-purple-700 border-purple-200',
    hubspot: 'bg-orange-100 text-orange-700 border-orange-200',
    shopify: 'bg-green-100 text-green-700 border-green-200',
  };
  return map[type];
}

function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ---------------------------------------------------------------------------
// Stats card
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Create Form Dialog
// ---------------------------------------------------------------------------

interface CreateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
}

function CreateFormDialog({ open, onOpenChange, orgSlug }: CreateFormDialogProps) {
  const router = useRouter();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [incentive, setIncentive] = React.useState('');
  const [hostingType, setHostingType] = React.useState<HostingType>('own_domain');
  const [loading, setLoading] = React.useState(false);

  function handleClose(open: boolean) {
    if (!loading) onOpenChange(open);
  }

  async function handleCreate() {
    if (!title.trim()) {
      toast.error('Form title is required.');
      return;
    }
    setLoading(true);
    // Simulate creation delay then navigate to builder
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    onOpenChange(false);
    // Navigate to the builder for a new form (mock id = "new")
    router.push(`/organizations/${orgSlug}/leads/new/builder`);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create New Lead Form</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cf-title">
              Form Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cf-title"
              placeholder="e.g. Summer Sale Sign-Up"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-description">Description</Label>
            <Textarea
              id="cf-description"
              placeholder="Brief description of this form"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-incentive">Incentive Text</Label>
            <Input
              id="cf-incentive"
              placeholder="e.g. Get 20% off your first order"
              value={incentive}
              onChange={(e) => setIncentive(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cf-hosting">Hosting Type</Label>
            <Select
              value={hostingType}
              onValueChange={(v) => setHostingType(v as HostingType)}
            >
              <SelectTrigger id="cf-hosting">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="own_domain">Own Domain</SelectItem>
                <SelectItem value="typeform">Typeform</SelectItem>
                <SelectItem value="hubspot">HubSpot</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating…' : 'Create Form'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirm Dialog
// ---------------------------------------------------------------------------

function DeleteDialog({
  open,
  formTitle,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  formTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Delete Form</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{' '}
          <span className="font-medium text-foreground">"{formTitle}"</span>? This action cannot be
          undone and all submissions will be lost.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface LeadsClientProps {
  orgId: string;
  orgSlug: string;
}

export function LeadsClient({ orgSlug }: LeadsClientProps) {
  const [forms, setForms] = React.useState<LeadForm[]>(MOCK_FORMS);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<LeadForm | null>(null);

  const totalSubmissions = forms.reduce((acc, f) => acc + f.submission_count, 0);
  const avgConversion =
    forms.length > 0
      ? (forms.reduce((acc, f) => acc + f.conversion_rate, 0) / forms.length).toFixed(1)
      : '0.0';

  function handleCopyLink(url: string | null) {
    if (!url) {
      toast.error('This form has no published URL yet.');
      return;
    }
    void navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard.');
  }

  function handleDelete(form: LeadForm) {
    setDeleteTarget(form);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setForms((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    toast.success(`"${deleteTarget.title}" has been deleted.`);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2">
            <ClipboardListIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Lead Forms</h2>
            <p className="text-sm text-muted-foreground">
              Create and manage lead capture forms. Embed on any page to collect customer
              information.
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New Form
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Forms" value={forms.length} />
        <StatCard label="Total Submissions" value={totalSubmissions.toLocaleString()} />
        <StatCard label="Avg Conversion Rate" value={`${avgConversion}%`} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Form Name</TableHead>
                <TableHead>Hosting</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Conv. Rate</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => (
                <TableRow key={form.id}>
                  <TableCell className="pl-4">
                    <p className="font-medium text-foreground">{form.title}</p>
                    {form.description && (
                      <p className="text-xs text-muted-foreground">
                        {truncate(form.description, 60)}
                      </p>
                    )}
                  </TableCell>

                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${hostingBadgeClass(form.hosting_type)}`}
                    >
                      {hostingLabel(form.hosting_type)}
                    </span>
                  </TableCell>

                  <TableCell>
                    {form.is_active ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <TrendingUpIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{form.submission_count.toLocaleString()}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm">{form.conversion_rate}%</span>
                  </TableCell>

                  <TableCell className="pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/organizations/${orgSlug}/leads/${form.id}/submissions`}>
                          View Submissions
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/organizations/${orgSlug}/leads/${form.id}/builder`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopyLink(form.published_url)}
                        title="Copy link"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(form)}
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {forms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    No lead forms yet. Click "New Form" to create your first one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgSlug={orgSlug}
      />

      {deleteTarget && (
        <DeleteDialog
          open={!!deleteTarget}
          formTitle={deleteTarget.title}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  GripVerticalIcon,
  MailIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader } from '@workspace/ui/components/card';
import { Checkbox } from '@workspace/ui/components/checkbox';
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
import { Separator } from '@workspace/ui/components/separator';
import { Switch } from '@workspace/ui/components/switch';
import { Textarea } from '@workspace/ui/components/textarea';
import { toast } from '@workspace/ui/components/sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldType = 'text' | 'email' | 'phone' | 'select' | 'textarea' | 'checkbox';
type HostingType = 'own_domain' | 'typeform' | 'hubspot' | 'shopify';

interface FormField {
  id: string;
  name: string;
  type: FieldType;
  label: string;
  required: boolean;
}

// ---------------------------------------------------------------------------
// Default fields
// ---------------------------------------------------------------------------

const DEFAULT_FIELDS: FormField[] = [
  { id: 'f1', name: 'name', type: 'text', label: 'Full Name', required: true },
  { id: 'f2', name: 'email', type: 'email', label: 'Email Address', required: true },
  { id: 'f3', name: 'phone', type: 'phone', label: 'Phone Number', required: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fieldTypeIcon(type: FieldType) {
  switch (type) {
    case 'email':
      return <MailIcon className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'phone':
      return <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function fieldTypeLabel(type: FieldType): string {
  const map: Record<FieldType, string> = {
    text: 'Text',
    email: 'Email',
    phone: 'Phone',
    select: 'Select',
    textarea: 'Textarea',
    checkbox: 'Checkbox',
  };
  return map[type];
}

function generateUrl(hosting: HostingType, formId: string): string {
  switch (hosting) {
    case 'typeform':
      return `https://forms.typeform.com/to/${formId}`;
    case 'hubspot':
      return `https://share.hsforms.com/${formId}`;
    case 'shopify':
      return `https://your-store.myshopify.com/pages/form-${formId}`;
    default:
      return `https://app.accelerate.inmobi.com/forms/${formId}`;
  }
}

// ---------------------------------------------------------------------------
// Preview field renderer
// ---------------------------------------------------------------------------

function PreviewField({ field }: { field: FormField }) {
  if (field.type === 'textarea') {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <textarea
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 resize-none"
          rows={3}
          placeholder={`Enter ${field.label.toLowerCase()}…`}
          readOnly
        />
      </div>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded border border-gray-300 bg-gray-50" />
        <label className="text-xs text-gray-700">{field.label}</label>
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
          <span>Select an option…</span>
          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400"
        type={field.type === 'phone' ? 'tel' : field.type}
        placeholder={`Enter ${field.label.toLowerCase()}…`}
        readOnly
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publish Dialog
// ---------------------------------------------------------------------------

function PublishDialog({
  open,
  onOpenChange,
  hosting,
  formId,
  formTitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hosting: HostingType;
  formId: string;
  formTitle: string;
}) {
  const url = generateUrl(hosting, formId);
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Publish Form</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Your form <span className="font-medium text-foreground">"{formTitle}"</span> is ready
            to be published. Share this URL to start collecting leads.
          </p>
          <div className="space-y-1.5">
            <Label>Generated URL</Label>
            <div className="flex items-center gap-2">
              <Input value={url} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy} title="Copy URL">
                {copied ? (
                  <CheckIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Hosting type:{' '}
            <span className="font-medium capitalize">{hosting.replace('_', ' ')}</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Add Field Picker
// ---------------------------------------------------------------------------

const FIELD_TYPES: FieldType[] = ['text', 'email', 'phone', 'select', 'textarea', 'checkbox'];

function AddFieldPicker({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (type: FieldType) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2">
          {FIELD_TYPES.map((type) => (
            <button
              key={type}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
              onClick={() => {
                onAdd(type);
                onOpenChange(false);
              }}
            >
              {fieldTypeIcon(type)}
              {fieldTypeLabel(type)}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface FormBuilderClientProps {
  orgId: string;
  orgSlug: string;
  formId: string;
}

export function FormBuilderClient({ orgSlug, formId }: FormBuilderClientProps) {
  const [title, setTitle] = React.useState(
    formId === 'new' ? '' : 'Summer Sale Sign-Up'
  );
  const [description, setDescription] = React.useState(
    formId === 'new' ? '' : 'Get 20% off your first order'
  );
  const [incentive, setIncentive] = React.useState(
    formId === 'new' ? '' : 'Get 20% off your first order'
  );
  const [hosting, setHosting] = React.useState<HostingType>('own_domain');
  const [fields, setFields] = React.useState<FormField[]>(DEFAULT_FIELDS);
  const [addFieldOpen, setAddFieldOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  function handleAddField(type: FieldType) {
    const newField: FormField = {
      id: `f${Date.now()}`,
      name: `field_${fields.length + 1}`,
      type,
      label: fieldTypeLabel(type) + ' Field',
      required: false,
    };
    setFields((prev) => [...prev, newField]);
  }

  function handleDeleteField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function handleToggleRequired(id: string, checked: boolean) {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, required: checked } : f))
    );
  }

  function handleLabelChange(id: string, label: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
  }

  async function handleSaveDraft() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success('Draft saved.');
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <div>
        <Link
          href={`/organizations/${orgSlug}/leads`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back to Lead Forms
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* LEFT — Field Editor */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <h3 className="text-base font-semibold text-foreground">Form Settings</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fb-title">Form Title</Label>
                <Input
                  id="fb-title"
                  placeholder="e.g. Summer Sale Sign-Up"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fb-desc">Description</Label>
                <Textarea
                  id="fb-desc"
                  placeholder="Brief description shown on the form"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fb-incentive">Incentive Text</Label>
                <Input
                  id="fb-incentive"
                  placeholder="e.g. Get 20% off your first order"
                  value={incentive}
                  onChange={(e) => setIncentive(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fb-hosting">Hosting Type</Label>
                <Select
                  value={hosting}
                  onValueChange={(v) => setHosting(v as HostingType)}
                >
                  <SelectTrigger id="fb-hosting">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Form Fields</h3>
                <Badge variant="secondary">{fields.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5"
                >
                  <GripVerticalIcon className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />
                  <div className="flex-shrink-0">{fieldTypeIcon(field.type)}</div>
                  <Input
                    className="h-7 flex-1 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                    value={field.label}
                    onChange={(e) => handleLabelChange(field.id, e.target.value)}
                  />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">Req</span>
                    <Switch
                      checked={field.required}
                      onCheckedChange={(checked) => handleToggleRequired(field.id, checked)}
                      className="scale-75"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => handleDeleteField(field.id)}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              {fields.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No fields yet. Add a field below.
                </p>
              )}

              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => setAddFieldOpen(true)}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Preview panel */}
        <div className="sticky top-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Live Preview
              </span>
              <Badge variant="outline" className="text-xs">
                {fields.length} field{fields.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <CardContent className="p-6">
              <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
                {/* Form header */}
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    {title || 'Your Form Title'}
                  </h3>
                  {description && (
                    <p className="text-sm text-gray-500">{description}</p>
                  )}
                </div>

                {/* Incentive banner */}
                {incentive && (
                  <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
                    <p className="text-sm font-medium text-blue-700">{incentive}</p>
                  </div>
                )}

                <Separator className="bg-gray-100" />

                {/* Fields */}
                <div className="space-y-4">
                  {fields.map((field) => (
                    <PreviewField key={field.id} field={field} />
                  ))}
                  {fields.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-4">
                      Add fields to preview them here.
                    </p>
                  )}
                </div>

                {/* Submit button */}
                <button
                  className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white opacity-80 cursor-default"
                  disabled
                >
                  Submit
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4 mt-2">
        <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
          {saving ? 'Saving…' : 'Save Draft'}
        </Button>
        <Button onClick={() => setPublishOpen(true)}>Publish Form</Button>
      </div>

      {/* Dialogs */}
      <AddFieldPicker
        open={addFieldOpen}
        onOpenChange={setAddFieldOpen}
        onAdd={handleAddField}
      />

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        hosting={hosting}
        formId={formId}
        formTitle={title || 'Untitled Form'}
      />
    </div>
  );
}

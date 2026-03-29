'use client';

import * as React from 'react';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  DownloadIcon,
  ExternalLinkIcon,
  TrendingUpIcon,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent } from '@workspace/ui/components/card';
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
import { toast } from '@workspace/ui/components/sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubmissionStatus = 'new' | 'contacted' | 'converted';

interface Submission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source_url: string;
  submitted_at: string;
  status: SubmissionStatus;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah@email.com',
    phone: '+1 555 0101',
    source_url: 'https://example.com/blog',
    submitted_at: '2026-03-29T10:23:00',
    status: 'new',
  },
  {
    id: '2',
    name: 'Mike Chen',
    email: 'mike@company.com',
    phone: null,
    source_url: 'https://example.com/',
    submitted_at: '2026-03-29T09:15:00',
    status: 'contacted',
  },
  {
    id: '3',
    name: 'Priya Patel',
    email: 'priya.patel@gmail.com',
    phone: '+44 7700 900123',
    source_url: 'https://example.com/products/shoes',
    submitted_at: '2026-03-28T18:42:00',
    status: 'converted',
  },
  {
    id: '4',
    name: 'James O\'Brien',
    email: 'james.obrien@outlook.com',
    phone: '+1 555 0188',
    source_url: 'https://example.com/sale',
    submitted_at: '2026-03-28T14:05:00',
    status: 'new',
  },
  {
    id: '5',
    name: 'Aiko Tanaka',
    email: 'aiko.t@tanaka-co.jp',
    phone: null,
    source_url: 'https://example.com/blog/summer',
    submitted_at: '2026-03-28T11:30:00',
    status: 'new',
  },
  {
    id: '6',
    name: 'Carlos Rivera',
    email: 'carlos@rivera.mx',
    phone: '+52 55 1234 5678',
    source_url: 'https://example.com/',
    submitted_at: '2026-03-27T22:10:00',
    status: 'contacted',
  },
  {
    id: '7',
    name: 'Emma Williams',
    email: 'emma.w@yahoo.co.uk',
    phone: '+44 7911 123456',
    source_url: 'https://example.com/products/bags',
    submitted_at: '2026-03-27T16:55:00',
    status: 'converted',
  },
  {
    id: '8',
    name: 'Liam Anderson',
    email: 'liam.anderson@proton.me',
    phone: '+1 555 0244',
    source_url: 'https://example.com/checkout',
    submitted_at: '2026-03-27T09:20:00',
    status: 'new',
  },
  {
    id: '9',
    name: 'Fatima Al-Hassan',
    email: 'fatima@alhassan.ae',
    phone: null,
    source_url: 'https://example.com/sale',
    submitted_at: '2026-03-26T20:05:00',
    status: 'new',
  },
  {
    id: '10',
    name: 'Noah Kim',
    email: 'noah.kim@gmail.com',
    phone: '+82 10 1234 5678',
    source_url: 'https://example.com/blog/new-arrivals',
    submitted_at: '2026-03-26T13:45:00',
    status: 'contacted',
  },
];

const FORM_TITLE_MAP: Record<string, string> = {
  '1': 'Summer Sale Sign-Up',
  '2': 'Product Launch Waitlist',
  '3': 'Newsletter Signup',
  new: 'New Form',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function truncateUrl(url: string, max = 35): string {
  try {
    const u = new URL(url);
    const path = u.hostname + u.pathname;
    return path.length > max ? path.slice(0, max) + '…' : path;
  } catch {
    return url.length > max ? url.slice(0, max) + '…' : url;
  }
}

function statusBadge(status: SubmissionStatus) {
  switch (status) {
    case 'new':
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
          New
        </Badge>
      );
    case 'contacted':
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">
          Contacted
        </Badge>
      );
    case 'converted':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
          Converted
        </Badge>
      );
  }
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
// Main component
// ---------------------------------------------------------------------------

interface SubmissionsClientProps {
  orgId: string;
  orgSlug: string;
  formId: string;
}

export function SubmissionsClient({ orgSlug, formId }: SubmissionsClientProps) {
  const [submissions, setSubmissions] = React.useState<Submission[]>(MOCK_SUBMISSIONS);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | SubmissionStatus>('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const formTitle = FORM_TITLE_MAP[formId] ?? 'Lead Form';

  // Filtered submissions
  const filtered = submissions.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.email.toLowerCase().includes(q) &&
        !(s.phone ?? '').includes(q)
      ) {
        return false;
      }
    }
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (dateFrom) {
      if (new Date(s.submitted_at) < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      if (new Date(s.submitted_at) > new Date(dateTo + 'T23:59:59')) return false;
    }
    return true;
  });

  const thisWeekCount = submissions.filter((s) => {
    const diff = Date.now() - new Date(s.submitted_at).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  }).length;

  function handleMarkContacted(id: string) {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'contacted' } : s))
    );
    toast.success('Marked as contacted.');
  }

  function handleMarkConverted(id: string) {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'converted' } : s))
    );
    toast.success('Marked as converted.');
  }

  async function handleExportCsv() {
    toast.info('Exporting 342 leads…');
    await new Promise((r) => setTimeout(r, 1000));
    toast.success('Downloaded leads_form.csv');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href={`/organizations/${orgSlug}/leads`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Lead Forms
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">Lead Submissions</h2>
            <span className="text-muted-foreground">/</span>
            <span className="text-base text-muted-foreground">{formTitle}</span>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportCsv}>
          <DownloadIcon className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Submissions" value="342" />
        <StatCard label="This Week" value={thisWeekCount} />
        <StatCard label="Avg Per Day" value="11.4" />
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label htmlFor="sub-search">Search</Label>
              <Input
                id="sub-search"
                placeholder="Name, email, or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-from">From</Label>
              <Input
                id="sub-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-to">To</Label>
              <Input
                id="sub-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-status">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger id="sub-status" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="pl-4 font-medium">{sub.name}</TableCell>

                  <TableCell>
                    <a
                      href={`mailto:${sub.email}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {sub.email}
                    </a>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {sub.phone ?? '—'}
                  </TableCell>

                  <TableCell>
                    <a
                      href={sub.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {truncateUrl(sub.source_url)}
                      <ExternalLinkIcon className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {relativeTime(sub.submitted_at)}
                  </TableCell>

                  <TableCell>{statusBadge(sub.status)}</TableCell>

                  <TableCell className="pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {sub.status !== 'contacted' && sub.status !== 'converted' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkContacted(sub.id)}
                        >
                          <TrendingUpIcon className="mr-1.5 h-3.5 w-3.5" />
                          Mark Contacted
                        </Button>
                      )}
                      {sub.status !== 'converted' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkConverted(sub.id)}
                        >
                          <CheckCircleIcon className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                          Mark Converted
                        </Button>
                      )}
                      {sub.status === 'converted' && (
                        <span className="text-xs text-muted-foreground italic">Converted</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No submissions match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

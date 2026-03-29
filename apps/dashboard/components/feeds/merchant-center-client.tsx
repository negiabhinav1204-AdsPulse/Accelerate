'use client';

import * as React from 'react';
import {
  CheckCircleIcon,
  Loader2Icon,
  ShoppingBagIcon,
  UploadIcon,
  WifiOffIcon,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
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
// Mock data
// ---------------------------------------------------------------------------

const MOCK_GMC_STATE = {
  connected: true,
  merchant_id: '123456789',
  account_name: 'My Store — Merchant',
};

const APPROVAL_STATS = {
  approved: 487,
  pending: 24,
  disapproved: 12,
  total: 523,
};

const PIE_DATA = [
  { name: 'Approved', value: APPROVAL_STATS.approved },
  { name: 'Pending', value: APPROVAL_STATS.pending },
  { name: 'Disapproved', value: APPROVAL_STATS.disapproved },
];

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

const DISAPPROVED_PRODUCTS = [
  {
    id: 'p1',
    title: 'Running Shoes Pro',
    issue: 'Missing GTIN',
    resolution: 'Add barcode/UPC',
  },
  {
    id: 'p2',
    title: 'Blue Hoodie XL',
    issue: 'Price mismatch',
    resolution: 'Update price to match website',
  },
  {
    id: 'p3',
    title: 'Coffee Mug Set',
    issue: 'Invalid image URL',
    resolution: 'Re-upload product images',
  },
  {
    id: 'p4',
    title: 'Yoga Mat Premium',
    issue: 'Shipping not set',
    resolution: 'Configure shipping settings',
  },
];

// ---------------------------------------------------------------------------
// Google icon
// ---------------------------------------------------------------------------

function GoogleIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className="size-10">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface MerchantCenterClientProps {
  orgId: string;
  orgSlug: string;
}

export function MerchantCenterClient({
  orgId,
  orgSlug,
}: MerchantCenterClientProps): React.JSX.Element {
  const [connected] = React.useState(MOCK_GMC_STATE.connected);
  const [pushing, setPushing] = React.useState(false);

  function handlePushFeed(): void {
    setPushing(true);
    toast.loading('Pushing full feed…', { id: 'gmc-push' });
    setTimeout(() => {
      setPushing(false);
      toast.success('Feed pushed to Google Merchant Center', {
        id: 'gmc-push',
        description: '523 products synced.',
      });
    }, 2000);
  }

  const statCards = [
    {
      label: 'Total Products',
      value: APPROVAL_STATS.total,
      colorClass: 'text-foreground',
    },
    {
      label: 'Approved',
      value: APPROVAL_STATS.approved,
      colorClass: 'text-green-600',
    },
    {
      label: 'Pending Review',
      value: APPROVAL_STATS.pending,
      colorClass: 'text-yellow-600',
    },
    {
      label: 'Disapproved',
      value: APPROVAL_STATS.disapproved,
      colorClass: 'text-red-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Connection status card */}
      <Card className="border bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {/* Icon area */}
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border bg-muted/30 shadow-sm">
              <GoogleIcon />
            </div>

            {/* Details */}
            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Google Merchant Center</h2>
                {connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircleIcon className="size-3.5" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    <WifiOffIcon className="size-3.5" />
                    Not Connected
                  </span>
                )}
              </div>
              {connected && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Merchant ID:{' '}
                    <span className="font-mono font-medium text-foreground">
                      {MOCK_GMC_STATE.merchant_id}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Account:{' '}
                    <span className="font-medium text-foreground">
                      {MOCK_GMC_STATE.account_name}
                    </span>
                  </p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {connected ? (
                <Button variant="outline" size="sm">
                  Disconnect
                </Button>
              ) : (
                <Button size="sm">Connect Google Merchant Center</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {connected && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statCards.map((s) => (
              <Card key={s.label} className="border bg-white">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.colorClass}`}>
                    {s.value.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pie chart + disapprovals */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Pie chart */}
            <Card className="border bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Approval Status</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="h-[200px] w-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={PIE_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {PIE_DATA.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [value.toLocaleString(), '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5 text-sm">
                  {PIE_DATA.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ background: PIE_COLORS[i] }}
                      />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-medium tabular-nums">
                        {d.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Disapprovals table */}
            <Card className="col-span-1 border bg-white lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Disapprovals</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DISAPPROVED_PRODUCTS.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-red-200 bg-red-50 text-red-700"
                          >
                            {product.issue}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.resolution}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            Fix
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Push + last sync */}
          <div className="flex items-center justify-between rounded-lg border bg-white px-5 py-4">
            <div>
              <p className="text-sm font-medium">Full Feed Sync</p>
              <p className="text-xs text-muted-foreground">Last synced: 2 hours ago</p>
            </div>
            <Button onClick={handlePushFeed} disabled={pushing}>
              {pushing ? (
                <Loader2Icon className="mr-1.5 size-4 animate-spin" />
              ) : (
                <UploadIcon className="mr-1.5 size-4" />
              )}
              Push Full Feed
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

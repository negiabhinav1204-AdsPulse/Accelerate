import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

// CSV column mapping — accepts common header variants
const HEADER_MAP: Record<string, string> = {
  title: 'title',
  name: 'title',
  'product title': 'title',
  'product name': 'title',
  description: 'description',
  desc: 'description',
  price: 'price',
  'sale price': 'salePrice',
  saleprice: 'salePrice',
  sku: 'sku',
  barcode: 'barcode',
  gtin: 'barcode',
  brand: 'brand',
  category: 'category',
  'google category': 'category',
  'image url': 'imageUrl',
  image: 'imageUrl',
  inventory: 'inventory',
  stock: 'inventory',
  quantity: 'inventory',
  currency: 'currency',
  availability: 'availability',
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = lines[0]!.split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const headers = rawHeaders.map((h) => HEADER_MAP[h] ?? h);

  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

/** Find or create the special "manual upload" connector for this org */
async function getOrCreateManualConnector(orgId: string, platform: 'MANUAL' | 'CSV'): Promise<string> {
  const existing = await prisma.commerceConnector.findFirst({
    where: { organizationId: orgId, platform, isActive: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.commerceConnector.create({
    data: {
      organizationId: orgId,
      platform,
      name: platform === 'CSV' ? 'CSV Upload' : 'Manual Entry',
      credentials: {},
      syncStatus: 'SYNCED',
      isActive: true,
      metadata: {},
    },
    select: { id: true },
  });
  return created.id;
}

// ── POST /api/products/upload ─────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  }

  // Verify membership
  const member = await prisma.membership.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const contentType = req.headers.get('content-type') ?? '';

  // ── CSV upload ─────────────────────────────────────────────────────────────
  if (contentType.includes('text/csv') || contentType.includes('multipart/form-data')) {
    let csvText = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      csvText = await (file as File).text();
    } else {
      csvText = await req.text();
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV has no valid rows' }, { status: 400 });
    }

    const connectorId = await getOrCreateManualConnector(orgId, 'CSV');
    const errors: string[] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (!row['title']) { errors.push(`Row ${i + 2}: missing title`); continue; }

      const price = parseFloat(row['price'] ?? '0');
      if (isNaN(price) || price <= 0) { errors.push(`Row ${i + 2}: invalid price`); continue; }

      const externalId = row['sku'] ?? `csv-${Date.now()}-${i}`;

      const productData = {
        title: row['title']!,
        description: row['description'] ?? null,
        price,
        salePrice: row['salePrice'] ? parseFloat(row['salePrice']) : null,
        brand: row['brand'] ?? null,
        googleCategory: row['category'] ?? null,
        imageUrl: row['imageUrl'] ?? null,
        currency: row['currency'] ?? 'USD',
        barcode: row['barcode'] ?? null,
        sku: row['sku'] ?? null,
        availability: row['availability'] ?? 'in stock',
        lastSyncAt: new Date(),
      };

      try {
        const existing = await prisma.feedProduct.findFirst({
          where: { connectorId, externalProductId: externalId, externalVariantId: null },
          select: { id: true },
        });
        if (existing) {
          await prisma.feedProduct.update({ where: { id: existing.id }, data: productData });
        } else {
          await prisma.feedProduct.create({
            data: { organizationId: orgId, connectorId, externalProductId: externalId, additionalImages: [], ...productData },
          });
        }
        imported++;
      } catch {
        errors.push(`Row ${i + 2}: failed to save`);
      }
    }

    return NextResponse.json({ imported, errors, total: rows.length });
  }

  // ── Manual product entry (JSON) ────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    const body = (await req.json()) as {
      title: string;
      sku?: string;
      price: number;
      description?: string;
      brand?: string;
      category?: string;
      imageUrl?: string;
      inventory?: number;
      currency?: string;
      barcode?: string;
      salePrice?: number;
      availability?: string;
    };

    if (!body.title || !body.price) {
      return NextResponse.json({ error: 'title and price are required' }, { status: 400 });
    }

    const connectorId = await getOrCreateManualConnector(orgId, 'MANUAL');
    const externalId = body.sku ?? `manual-${Date.now()}`;

    const productData = {
      title: body.title,
      description: body.description ?? null,
      price: body.price,
      salePrice: body.salePrice ?? null,
      brand: body.brand ?? null,
      googleCategory: body.category ?? null,
      imageUrl: body.imageUrl ?? null,
      currency: body.currency ?? 'USD',
      barcode: body.barcode ?? null,
      sku: body.sku ?? null,
      availability: body.availability ?? 'in stock',
      lastSyncAt: new Date(),
    };

    try {
      const existing = await prisma.feedProduct.findFirst({
        where: { connectorId, externalProductId: externalId, externalVariantId: null },
        select: { id: true },
      });

      let product;
      if (existing) {
        product = await prisma.feedProduct.update({ where: { id: existing.id }, data: productData });
      } else {
        product = await prisma.feedProduct.create({
          data: { organizationId: orgId, connectorId, externalProductId: externalId, additionalImages: [], ...productData },
        });
      }

      return NextResponse.json({ imported: 1, product });
    } catch {
      return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
}

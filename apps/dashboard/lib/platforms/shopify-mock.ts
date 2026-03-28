// Mock Shopify product data — used for demo while app registration is pending.
// Replace with real Shopify API calls once SHOPIFY_CLIENT_ID/SECRET are configured.

export type ChannelStatus = 'approved' | 'active' | 'pending' | 'disapproved' | 'not_submitted';

export type MockProduct = {
  id: string;
  externalProductId: string;
  title: string;
  description: string;
  price: number;
  salePrice?: number;
  currency: string;
  sku: string;
  barcode?: string;
  brand: string;
  category: string;
  imageUrl: string;
  inventory: number;
  variants: number;
  availability: 'in stock' | 'out of stock' | 'preorder';
  channelStatus: {
    google: ChannelStatus;
    meta: ChannelStatus;
    microsoft: ChannelStatus;
  };
  issues?: string[];
  lastSyncAt?: string;
  // Performance metrics (from Google Ads / last 30 days)
  impressions: number;
  clicks: number;
  lastImpressionDaysAgo: number; // days since last impression; 999 = never
  customLabel?: string;          // set when zombie-labeled
  // Sales velocity metrics
  velocity_30d: number;          // units sold in last 30 days
  sold_30d: number;              // alias for velocity_30d (used by AI chat tools)
};

export const MOCK_SHOPIFY_STORE = {
  shopDomain: 'demo-store.myshopify.com',
  storeName: 'Demo Fashion Store',
  currency: 'USD',
  productCount: 10,
  lastSyncAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  status: 'connected'
};

export const MOCK_SHOPIFY_PRODUCTS: MockProduct[] = [
  {
    id: 'mock-001',
    externalProductId: '8234567890001',
    title: 'Premium Running Shoes – Air Boost X3',
    description: 'High-performance running shoes with Air Boost technology. Breathable mesh upper, responsive foam midsole. Available in 6 sizes.',
    price: 129.99,
    salePrice: 99.99,
    currency: 'USD',
    sku: 'RNS-ABX3-WHT',
    barcode: '0123456789001',
    brand: 'SpeedPro',
    category: 'Apparel & Accessories > Shoes',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop',
    inventory: 45,
    variants: 6,
    availability: 'in stock',
    channelStatus: { google: 'approved', meta: 'active', microsoft: 'pending' },
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    impressions: 4820, clicks: 143, lastImpressionDaysAgo: 0,
    velocity_30d: 28, sold_30d: 28
  },
  {
    id: 'mock-002',
    externalProductId: '8234567890002',
    title: 'Classic Leather Tote Bag',
    description: 'Handcrafted genuine leather tote bag with magnetic closure. Fits 13" laptop. Interior zip pocket and card slots.',
    price: 189.00,
    currency: 'USD',
    sku: 'BAG-LTH-TAN-L',
    barcode: '0123456789002',
    brand: 'Luxe Carry',
    category: 'Apparel & Accessories > Handbags',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200&h=200&fit=crop',
    inventory: 22,
    variants: 3,
    availability: 'in stock',
    channelStatus: { google: 'approved', meta: 'approved', microsoft: 'approved' },
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    impressions: 2910, clicks: 87, lastImpressionDaysAgo: 1,
    velocity_30d: 16, sold_30d: 16
  },
  {
    id: 'mock-003',
    externalProductId: '8234567890003',
    title: 'Wireless Noise-Cancelling Headphones Pro',
    description: '40-hour battery, active noise cancellation, premium drivers. Foldable design with carrying case.',
    price: 299.99,
    salePrice: 249.99,
    currency: 'USD',
    sku: 'AUD-WNC-PRO-BLK',
    barcode: '0123456789003',
    brand: 'SoundElite',
    category: 'Electronics > Audio > Headphones',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop',
    inventory: 18,
    variants: 2,
    availability: 'in stock',
    channelStatus: { google: 'disapproved', meta: 'active', microsoft: 'not_submitted' },
    issues: ['Missing GTIN — add barcode to fix', 'Google category too broad'],
    lastSyncAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    impressions: 6, clicks: 0, lastImpressionDaysAgo: 47,
    velocity_30d: 0, sold_30d: 0
  },
  {
    id: 'mock-004',
    externalProductId: '8234567890004',
    title: 'Organic Cotton Crew-Neck T-Shirt',
    description: '100% GOTS-certified organic cotton. Pre-shrunk, enzyme-washed for softness. Sizes XS–3XL.',
    price: 34.99,
    currency: 'USD',
    sku: 'TSH-ORG-WHT',
    brand: 'EcoWear',
    category: 'Apparel & Accessories > Clothing > Tops',
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&h=200&fit=crop',
    inventory: 130,
    variants: 12,
    availability: 'in stock',
    channelStatus: { google: 'approved', meta: 'active', microsoft: 'approved' },
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    impressions: 3540, clicks: 102, lastImpressionDaysAgo: 0,
    velocity_30d: 21, sold_30d: 21
  },
  {
    id: 'mock-005',
    externalProductId: '8234567890005',
    title: 'Stainless Steel Insulated Water Bottle 32oz',
    description: 'Triple-wall insulation keeps drinks cold 24hrs / hot 12hrs. BPA-free lid with carry loop. Dishwasher safe.',
    price: 44.95,
    currency: 'USD',
    sku: 'BTL-SS-32OZ-SLV',
    barcode: '0123456789005',
    brand: 'HydroMax',
    category: 'Sporting Goods > Water Sports > Accessories',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=200&h=200&fit=crop',
    inventory: 75,
    variants: 4,
    availability: 'in stock',
    channelStatus: { google: 'approved', meta: 'active', microsoft: 'pending' },
    lastSyncAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    impressions: 72, clicks: 3, lastImpressionDaysAgo: 35,
    velocity_30d: 1, sold_30d: 1
  },
  {
    id: 'mock-006',
    externalProductId: '8234567890006',
    title: 'Merino Wool Beanie – Winter Collection',
    description: 'Fine 100% merino wool. Naturally odour-resistant and temperature-regulating. One size fits most.',
    price: 49.00,
    salePrice: 35.00,
    currency: 'USD',
    sku: 'BNE-MRN-NVY',
    brand: 'Alpine Co.',
    category: 'Apparel & Accessories > Clothing Accessories > Hats',
    imageUrl: 'https://images.unsplash.com/photo-1510598155925-cff0c07c2c36?w=200&h=200&fit=crop',
    inventory: 0,
    variants: 5,
    availability: 'out of stock',
    channelStatus: { google: 'pending', meta: 'not_submitted', microsoft: 'not_submitted' },
    lastSyncAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    impressions: 0, clicks: 0, lastImpressionDaysAgo: 999,
    velocity_30d: 0, sold_30d: 0
  },
  {
    id: 'mock-007',
    externalProductId: '8234567890007',
    title: 'Yoga Mat – 6mm Non-Slip Professional',
    description: 'Dual-layer TPE foam with alignment lines. 183cm × 61cm. Includes carry strap. Eco-friendly, PVC-free.',
    price: 59.99,
    currency: 'USD',
    sku: 'YGA-MAT-6MM-PRP',
    barcode: '0123456789007',
    brand: 'FlexForm',
    category: 'Sporting Goods > Exercise & Fitness > Yoga',
    imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=200&h=200&fit=crop',
    inventory: 33,
    variants: 3,
    availability: 'in stock',
    channelStatus: { google: 'approved', meta: 'approved', microsoft: 'not_submitted' },
    lastSyncAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    impressions: 1680, clicks: 44, lastImpressionDaysAgo: 2,
    velocity_30d: 9, sold_30d: 9
  },
  {
    id: 'mock-008',
    externalProductId: '8234567890008',
    title: 'Ceramic Pour-Over Coffee Set',
    description: 'Hand-thrown ceramic dripper + matching carafe. Includes 40 filter papers. Makes 2–4 cups. Dishwasher safe.',
    price: 79.00,
    currency: 'USD',
    sku: 'COF-CER-PRO-WHT',
    brand: 'BrewCraft',
    category: 'Home & Garden > Kitchen & Dining > Coffee & Tea',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&h=200&fit=crop',
    inventory: 14,
    variants: 2,
    availability: 'in stock',
    channelStatus: { google: 'approved', meta: 'active', microsoft: 'approved' },
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    impressions: 18, clicks: 1, lastImpressionDaysAgo: 61,
    velocity_30d: 0, sold_30d: 0
  },
  {
    id: 'mock-009',
    externalProductId: '8234567890009',
    title: 'Minimalist Leather Wallet – Slim Card Holder',
    description: 'Full-grain vegetable-tanned leather. Holds 8 cards + cash. RFID blocking. Gets better with age.',
    price: 65.00,
    currency: 'USD',
    sku: 'WLT-SLM-BRN',
    barcode: '0123456789009',
    brand: 'Luxe Carry',
    category: 'Apparel & Accessories > Handbags > Wallets',
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=200&h=200&fit=crop',
    inventory: 52,
    variants: 3,
    availability: 'in stock',
    channelStatus: { google: 'approved', meta: 'active', microsoft: 'approved' },
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    impressions: 2200, clicks: 61, lastImpressionDaysAgo: 0,
    velocity_30d: 12, sold_30d: 12
  },
  {
    id: 'mock-010',
    externalProductId: '8234567890010',
    title: 'Plant-Based Protein Powder – Vanilla Oat 1kg',
    description: '25g protein per serving from pea + brown rice blend. No artificial sweeteners. Certified vegan, non-GMO.',
    price: 54.99,
    salePrice: 44.99,
    currency: 'USD',
    sku: 'NUT-PBP-VNL-1KG',
    barcode: '0123456789010',
    brand: 'GreenFuel',
    category: 'Health & Beauty > Health Care > Vitamins & Supplements',
    imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=200&h=200&fit=crop',
    inventory: 89,
    variants: 4,
    availability: 'in stock',
    channelStatus: { google: 'pending', meta: 'active', microsoft: 'not_submitted' },
    lastSyncAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    impressions: 44, clicks: 2, lastImpressionDaysAgo: 38,
    velocity_30d: 1, sold_30d: 1
  }
];

export function getMockProductStats() {
  const total = MOCK_SHOPIFY_PRODUCTS.length;
  let approved = 0;
  let pending = 0;
  let disapproved = 0;
  let notSubmitted = 0;

  for (const p of MOCK_SHOPIFY_PRODUCTS) {
    const statuses = Object.values(p.channelStatus);
    if (statuses.some((s) => s === 'disapproved')) disapproved++;
    else if (statuses.every((s) => s === 'approved' || s === 'active')) approved++;
    else if (statuses.some((s) => s === 'pending')) pending++;
    else notSubmitted++;
  }

  return { total, approved, pending, disapproved, notSubmitted };
}

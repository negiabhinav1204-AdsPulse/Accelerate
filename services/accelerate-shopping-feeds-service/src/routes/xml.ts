/**
 * GET /shopping-feeds/xml?orgId=&channel=&marketId=
 * Public endpoint — product feed for Google/Meta/Microsoft crawlers.
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';
import { MOCK_SHOPIFY_PRODUCTS } from '../lib/shopify-mock';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function xmlRoute(fastify: FastifyInstance) {
  fastify.get('/shopping-feeds/xml', async (request, reply) => {
    const { orgId, channel = 'google', marketId } = request.query as Record<string, string>;
    if (!orgId) return reply.status(400).send('orgId required');

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
    if (!org) return reply.status(404).send('Not found');

    let marketCurrency = 'USD';
    let marketLang = 'en';
    let marketCountry = 'US';
    if (marketId) {
      const market = await prisma.commerceMarket.findFirst({
        where: { id: marketId, organizationId: orgId },
        select: { currency: true, language: true, targetCountry: true }
      });
      if (market) {
        marketCurrency = market.currency;
        marketLang = market.language;
        marketCountry = market.targetCountry;
      }
    }

    const settings = await prisma.shoppingFeedSettings.findFirst({
      where: { organizationId: orgId },
      select: { productIdFormat: true, defaultGoogleCategory: true, defaultAgeGroup: true, enableSalePrice: true, enableUtmTracking: true, utmSource: true, utmMedium: true }
    });

    const dbProducts = await prisma.feedProduct.findMany({ where: { organizationId: orgId, isExcluded: false }, take: 5000 });

    const connector = await prisma.commerceConnector.findFirst({ where: { organizationId: orgId, isActive: true }, select: { name: true, metadata: true } });
    const meta = connector?.metadata as Record<string, string> | null;
    const storeUrl = meta?.storeUrl ? `https://${meta.storeUrl}` : 'https://demo-store.myshopify.com';
    const storeName = connector?.name ?? org.name ?? 'Store';

    let itemsXml = '';

    if (dbProducts.length > 0) {
      for (const p of dbProducts) {
        const productUrl = `${storeUrl}/products/${p.externalProductId}`;
        const utmSuffix = settings?.enableUtmTracking
          ? `?utm_source=${settings.utmSource}&utm_medium=${settings.utmMedium}&utm_campaign=${channel}`
          : '';
        const customLabels = p.customLabels as Record<string, string> | null;

        itemsXml += `
    <item>
      <g:id>${escapeXml(settings?.productIdFormat === 'sku' && p.sku ? p.sku : p.externalProductId)}</g:id>
      <g:title>${escapeXml(p.title)}</g:title>
      <g:description>${escapeXml(p.description ?? '')}</g:description>
      <g:link>${escapeXml(productUrl + utmSuffix)}</g:link>
      ${p.imageUrl ? `<g:image_link>${escapeXml(p.imageUrl)}</g:image_link>` : ''}
      <g:condition>${escapeXml(p.condition)}</g:condition>
      <g:availability>${escapeXml(p.availability)}</g:availability>
      <g:price>${Number(p.price).toFixed(2)} ${escapeXml(marketCurrency)}</g:price>
      ${settings?.enableSalePrice && p.salePrice ? `<g:sale_price>${Number(p.salePrice).toFixed(2)} ${escapeXml(marketCurrency)}</g:sale_price>` : ''}
      ${p.brand ? `<g:brand>${escapeXml(p.brand)}</g:brand>` : ''}
      ${p.barcode ? `<g:gtin>${escapeXml(p.barcode)}</g:gtin>` : ''}
      ${p.sku ? `<g:mpn>${escapeXml(p.sku)}</g:mpn>` : ''}
      ${p.googleCategory ?? settings?.defaultGoogleCategory ? `<g:google_product_category>${escapeXml((p.googleCategory ?? settings?.defaultGoogleCategory)!)}</g:google_product_category>` : ''}
      ${p.productType ? `<g:product_type>${escapeXml(p.productType)}</g:product_type>` : ''}
      ${settings?.defaultAgeGroup ? `<g:age_group>${escapeXml(settings.defaultAgeGroup)}</g:age_group>` : ''}
      ${p.color ? `<g:color>${escapeXml(p.color)}</g:color>` : ''}
      ${p.size ? `<g:size>${escapeXml(p.size)}</g:size>` : ''}
      ${p.itemGroupId ? `<g:item_group_id>${escapeXml(p.itemGroupId)}</g:item_group_id>` : ''}
      ${customLabels?.['custom_label_0'] ? `<g:custom_label_0>${escapeXml(customLabels['custom_label_0'])}</g:custom_label_0>` : ''}
      ${customLabels?.['custom_label_1'] ? `<g:custom_label_1>${escapeXml(customLabels['custom_label_1'])}</g:custom_label_1>` : ''}
      ${customLabels?.['custom_label_2'] ? `<g:custom_label_2>${escapeXml(customLabels['custom_label_2'])}</g:custom_label_2>` : ''}
      <g:shipping_country>${escapeXml(marketCountry)}</g:shipping_country>
    </item>`;
      }
    } else {
      for (const p of MOCK_SHOPIFY_PRODUCTS) {
        const productUrl = `${storeUrl}/products/${p.externalProductId}`;
        const utmSuffix = settings?.enableUtmTracking
          ? `?utm_source=${settings.utmSource ?? 'accelerate'}&utm_medium=${settings.utmMedium ?? 'cpc'}&utm_campaign=${channel}`
          : '';

        itemsXml += `
    <item>
      <g:id>${escapeXml(p.sku)}</g:id>
      <g:title>${escapeXml(p.title)}</g:title>
      <g:description>${escapeXml(p.description)}</g:description>
      <g:link>${escapeXml(productUrl + utmSuffix)}</g:link>
      <g:image_link>${escapeXml(p.imageUrl)}</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>${escapeXml(p.availability)}</g:availability>
      <g:price>${p.price.toFixed(2)} ${escapeXml(marketCurrency)}</g:price>
      ${settings?.enableSalePrice !== false && p.salePrice ? `<g:sale_price>${p.salePrice.toFixed(2)} ${escapeXml(marketCurrency)}</g:sale_price>` : ''}
      <g:brand>${escapeXml(p.brand)}</g:brand>
      ${p.barcode ? `<g:gtin>${escapeXml(p.barcode)}</g:gtin>` : ''}
      <g:mpn>${escapeXml(p.sku)}</g:mpn>
      <g:google_product_category>${escapeXml(p.category)}</g:google_product_category>
      ${settings?.defaultAgeGroup ? `<g:age_group>${escapeXml(settings.defaultAgeGroup)}</g:age_group>` : ''}
      ${p.customLabel ? `<g:custom_label_0>${escapeXml(p.customLabel)}</g:custom_label_0>` : ''}
      <g:shipping_country>${escapeXml(marketCountry)}</g:shipping_country>
    </item>`;
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(storeName)}</title>
    <link>${escapeXml(storeUrl)}</link>
    <description>${escapeXml(storeName)} — Product Feed (${channel}${marketId ? `, market: ${marketId}` : ''})</description>
    <language>${escapeXml(marketLang)}</language>${itemsXml}
  </channel>
</rss>`;

    return reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .send(xml);
  });
}

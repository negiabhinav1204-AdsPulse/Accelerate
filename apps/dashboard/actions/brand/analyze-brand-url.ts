'use server';

import Anthropic from '@anthropic-ai/sdk';

export type BrandAnalysisResult = {
  businessName: string;
  location: string;
  category: string;
};

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function analyzeBrandUrl(
  url: string
): Promise<BrandAnalysisResult> {
  // Normalize URL
  const normalized = url.startsWith('http') ? url : `https://${url}`;

  // Fetch the website HTML
  let pageContent = '';
  try {
    const response = await fetch(normalized, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; AccelerateBot/1.0; +https://accelerate.inmobi.com)'
      },
      signal: AbortSignal.timeout(8000)
    });
    const html = await response.text();
    // Strip tags and truncate to keep tokens reasonable
    pageContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  } catch {
    // If fetch fails, still try with just the URL
    pageContent = `Website: ${normalized}`;
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are a business analyst. Based on the website URL and page content below, extract the following details. Return ONLY a valid JSON object with no extra text.

URL: ${normalized}

Page content (truncated):
${pageContent}

Return this exact JSON structure:
{
  "businessName": "<the company/brand name>",
  "location": "<city and country, e.g. Mumbai, India — pick the most prominent location, or leave empty string if unclear>",
  "category": "<one of: E-Commerce / Retail, Technology / SaaS, Finance / Fintech, Healthcare / Pharma, Education / EdTech, Travel / Hospitality, Food & Beverage, Media / Entertainment, Real Estate, Automotive, Fashion / Apparel, Consumer Goods / FMCG — pick the closest match>"
}`
      }
    ]
  });

  const raw =
    message.content[0].type === 'text' ? message.content[0].text : '';

  // Parse JSON from the response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { businessName: '', location: '', category: '' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as BrandAnalysisResult;
    return {
      businessName: parsed.businessName ?? '',
      location: parsed.location ?? '',
      category: parsed.category ?? ''
    };
  } catch {
    return { businessName: '', location: '', category: '' };
  }
}

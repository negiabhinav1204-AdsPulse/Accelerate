/**
 * POST /api/campaign/generate-images
 * Generates ad creative images using Google Imagen 4 Fast.
 * Returns up to 3 base64 data URLs per request.
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';

type GenerateImagesRequest = {
  prompts: string[];
  aspectRatio?: '1:1' | '16:9' | '9:16';
  brandName?: string;
};

type ImagenPrediction = {
  bytesBase64Encoded: string;
  mimeType: string;
};

type ImagenResponse = {
  predictions?: ImagenPrediction[];
  error?: { code: number; message: string; status: string };
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: GenerateImagesRequest;
  try {
    body = (await request.json()) as GenerateImagesRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { prompts, aspectRatio = '1:1', brandName } = body;
  if (!prompts || prompts.length === 0) {
    return NextResponse.json({ error: 'prompts required' }, { status: 400 });
  }

  const imageUrls: string[] = [];
  const errors: string[] = [];

  for (const prompt of prompts.slice(0, 3)) {
    const enrichedPrompt = [
      prompt,
      brandName ? `for ${brandName}` : '',
      'Professional advertising photography, high quality, clean composition, suitable for digital advertising.'
    ].filter(Boolean).join('. ');

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: enrichedPrompt }],
            parameters: { sampleCount: 1, aspectRatio }
          })
        }
      );

      const data = (await res.json()) as ImagenResponse;

      if (data.error) {
        errors.push(data.error.message);
        continue;
      }

      const prediction = data.predictions?.[0];
      if (prediction?.bytesBase64Encoded) {
        imageUrls.push(`data:${prediction.mimeType ?? 'image/png'};base64,${prediction.bytesBase64Encoded}`);
      } else {
        errors.push('No image returned');
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return NextResponse.json({
    imageUrls,
    ...(errors.length > 0 ? { errors } : {})
  });
}

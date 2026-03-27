/**
 * Generates text embeddings using Gemini text-embedding-004 (768 dimensions).
 * Used by the memory service to embed memory node summaries for semantic search.
 */

type EmbedResponse = {
  embedding?: {
    values: number[];
  };
  error?: { message: string; code: number };
};

/**
 * Generate a 768-dimensional embedding vector for the given text.
 * Returns null if the API call fails (non-fatal — node stored without embedding).
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[embedding] GEMINI_API_KEY not set — skipping embedding');
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: text.slice(0, 2048) }] },
          taskType: 'SEMANTIC_SIMILARITY'
        })
      }
    );

    if (!response.ok) {
      console.warn('[embedding] API error', response.status);
      return null;
    }

    const data = (await response.json()) as EmbedResponse;
    return data.embedding?.values ?? null;
  } catch (err) {
    console.warn('[embedding] fetch failed', err);
    return null;
  }
}

/**
 * Format a number array as a Postgres vector literal: '[0.1,0.2,...]'
 */
export function vectorToSql(values: number[]): string {
  return `[${values.join(',')}]`;
}

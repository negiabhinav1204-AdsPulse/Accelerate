/**
 * Meta Graph API v23.0 helper
 *
 * Thin wrappers around the Meta Campaign API for pause/resume/update operations.
 */

const META_API_BASE = 'https://graph.facebook.com/v23.0'

async function metaPatch(
  campaignId: string,
  params: Record<string, string>,
  token: string
): Promise<void> {
  const url = `${META_API_BASE}/${campaignId}`
  const body = new URLSearchParams({ access_token: token, ...params })

  const res = await fetch(url, {
    method: 'PATCH',
    body,
    signal: AbortSignal.timeout(15000)
  })

  if (!res.ok) {
    let message = `Meta API error: ${res.status}`
    try {
      const json = (await res.json()) as { error?: { message?: string } }
      if (json.error?.message) message = json.error.message
    } catch {
      // ignore parse error, use default message
    }
    throw new Error(message)
  }
}

export async function pauseMetaCampaign(
  campaignId: string,
  _adAccountId: string,
  token: string
): Promise<void> {
  await metaPatch(campaignId, { status: 'PAUSED' }, token)
}

export async function resumeMetaCampaign(
  campaignId: string,
  _adAccountId: string,
  token: string
): Promise<void> {
  await metaPatch(campaignId, { status: 'ACTIVE' }, token)
}

export async function updateMetaCampaign(
  campaignId: string,
  fields: Record<string, unknown>,
  token: string
): Promise<void> {
  const url = `${META_API_BASE}/${campaignId}`
  const body = new URLSearchParams({ access_token: token })
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, String(value))
  }

  const res = await fetch(url, {
    method: 'PATCH',
    body,
    signal: AbortSignal.timeout(15000)
  })

  if (!res.ok) {
    let message = `Meta API error: ${res.status}`
    try {
      const json = (await res.json()) as { error?: { message?: string } }
      if (json.error?.message) message = json.error.message
    } catch {
      // ignore parse error, use default message
    }
    throw new Error(message)
  }
}

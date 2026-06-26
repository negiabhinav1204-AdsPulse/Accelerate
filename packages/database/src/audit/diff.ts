export function computeFieldDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): Record<string, { old: unknown; new: unknown }> {
  const out: Record<string, { old: unknown; new: unknown }> = {};
  for (const f of fields) {
    const a = before?.[f];
    const b = after?.[f];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[f] = { old: a ?? null, new: b ?? null };
    }
  }
  return out;
}

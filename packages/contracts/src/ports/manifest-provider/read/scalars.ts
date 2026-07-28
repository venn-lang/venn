// Reading a parsed TOML value as the shape the manifest expects. None of these
// throw: a malformed table reads as an empty one, so one bad line never stops a
// project from opening.

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function asStringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(asRecord(value))) out[key] = String(item);
  return out;
}

export function asList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function asRecords(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function asString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

export function asNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return value === undefined || Number.isNaN(parsed) ? undefined : parsed;
}

export function asBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  return value === true || value === "true";
}

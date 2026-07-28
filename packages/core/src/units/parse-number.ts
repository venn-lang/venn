import type { UnitValue } from "./unit.types.js";

const DURATION_MS: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000 };
const SIZE_BYTES: Record<string, number> = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 };

/**
 * Lexemes already read, keyed by their text.
 *
 * Callers pass `NumberLit.raw`, so this holds one entry per literal written in
 * the loaded programs. Handing the same parsed value to every caller is safe:
 * numbers are primitives and a `UnitValue` is readonly throughout, so `combine`
 * builds new values rather than mutating.
 */
const parsed = new Map<string, number | UnitValue>();

/**
 * Read a NUMBER lexeme into the value it denotes.
 *
 * Accepts digit grouping and an optional unit suffix: "200", "1_000", "300ms",
 * "2mb", "50%". A lexeme with no recognised suffix reads as a plain number.
 *
 * @returns A number, or the `UnitValue` the suffix asks for.
 */
export function parseNumber(raw: string): number | UnitValue {
  const known = parsed.get(raw);
  if (known !== undefined) return known;
  const value = readLexeme(raw);
  parsed.set(raw, value);
  return value;
}

function readLexeme(raw: string): number | UnitValue {
  // `_` groups digits for the reader and means nothing to the value: the
  // grammar only lets it sit between them, so dropping it is safe here.
  const digits = raw.includes("_") ? raw.replaceAll("_", "") : raw;
  const match = /^([0-9]+(?:\.[0-9]+)?)(ms|kb|mb|gb|b|s|m|h|%)?$/.exec(digits);
  if (!match) return Number(digits);
  const value = Number(match[1]);
  return match[2] ? toUnitValue(value, match[2]) : value;
}

function toUnitValue(value: number, unit: string): UnitValue {
  const ms = DURATION_MS[unit];
  if (ms !== undefined) return { kind: "duration", ms: value * ms };
  const bytes = SIZE_BYTES[unit];
  if (bytes !== undefined) return { kind: "size", bytes: value * bytes };
  return { kind: "percent", ratio: value / 100 };
}

import type { Duration, Instant, Percent, Size, UnitValue } from "./unit.types.js";

/**
 * Whether this value is a length of time.
 *
 * @param value Anything at all.
 * @returns True only for an object carrying both `kind: "duration"` and a
 * numeric `ms`.
 */
export function isDuration(value: unknown): value is Duration {
  return hasBase(value, "duration", "ms");
}

/** Whether this value is a quantity of data: `kind: "size"` and numeric bytes. */
export function isSize(value: unknown): value is Size {
  return hasBase(value, "size", "bytes");
}

/** Whether this value is a proportion: `kind: "percent"` and a numeric ratio. */
export function isPercent(value: unknown): value is Percent {
  return hasBase(value, "percent", "ratio");
}

/** Whether this value is a point in time: `kind: "instant"` and numeric epochMs. */
export function isInstant(value: unknown): value is Instant {
  return hasBase(value, "instant", "epochMs");
}

/** Whether this value carries a unit: a duration, a size or a percent. */
export function isUnitValue(value: unknown): value is UnitValue {
  return isDuration(value) || isSize(value) || isPercent(value);
}

/**
 * A unit is told by its whole shape, never by its `kind` alone.
 *
 * `kind` is how this language spells a union, so people write maps like
 * `{ kind: "size", label: "x" }` and one of those used to be a size: `typeOf`
 * answered `"size"`, `.label` answered null because a unit publishes only its
 * own conversions, and `venn check` said the file was fine. Requiring the base
 * field as well costs one property read and makes an ordinary map an ordinary
 * map again.
 *
 * The mark is structural rather than a symbol because `structuredClone` drops
 * symbols, and a value crossing that copy has to still be what it was.
 */
function hasBase(value: unknown, kind: string, base: string): boolean {
  if (typeof value !== "object" || value === null) return false;
  const held = value as Record<string, unknown>;
  return held.kind === kind && typeof held[base] === "number";
}

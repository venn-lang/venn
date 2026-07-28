import type { Instant, UnitValue } from "./unit.types.js";

/** Whether this value carries a unit: a duration, a size or a percent. */
export function isUnitValue(value: unknown): value is UnitValue {
  return hasKind(value, ["duration", "size", "percent"]);
}

/** Whether this value is a point in time. */
export function isInstant(value: unknown): value is Instant {
  return hasKind(value, ["instant"]);
}

function hasKind(value: unknown, kinds: readonly string[]): boolean {
  if (typeof value !== "object" || value === null || !("kind" in value)) return false;
  return kinds.includes((value as { kind: string }).kind);
}

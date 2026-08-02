import { combine, isInstant, isUnitValue, type Numeric, parseNumber } from "../units/index.js";
import { BOOL, NUMBER, prim, type Type } from "./type.types.js";

/** One value of each kind, to ask `combine` what an operator does with them. */
const SAMPLES: Record<string, Numeric> = {
  number: 1,
  duration: { kind: "duration", ms: 1 },
  size: { kind: "size", bytes: 1 },
  percent: { kind: "percent", ratio: 1 },
  instant: { kind: "instant", epochMs: 1, iso: "1970-01-01T00:00:00.001Z" },
};

/** The type a NUMBER lexeme has: `200` is a number, `300ms` a duration, `2mb` a size. */
export function literalType(raw: string): Type {
  const value = parseNumber(raw);
  return typeof value === "number" ? NUMBER : prim(value.kind);
}

/** What an operator produces, or that its operands cannot be combined. */
export type UnitOutcome = { ok: true; type: Type } | { ok: false };

/**
 * The type `left op right` produces, decided by the very `combine` the evaluator
 * uses, handed one value of each kind rather than the real ones.
 *
 * Reusing it is the point. Unit compatibility is a single rule (`300ms + 1s`
 * yes, `300ms + 2mb` no), and writing it a second time for the checker would be
 * two rules that agree only until one of them changes.
 *
 * @returns undefined when either side is not a concrete number or unit: a type
 * variable still to be solved, `dynamic`, a string. Those keep the ordinary
 * path, which is what lets `fn double(x) => x * 2` learn that `x` is a number.
 */
export function combinedType(op: string, left: Type, right: Type): UnitOutcome | undefined {
  const a = sampleOf(left);
  const b = sampleOf(right);
  if (a === undefined || b === undefined) return undefined;
  const result = combine({ op, left: a, right: b });
  return result.ok ? { ok: true, type: typeOfValue(result.value) } : { ok: false };
}

function sampleOf(type: Type): Numeric | undefined {
  return type.kind === "prim" ? SAMPLES[type.name] : undefined;
}

function typeOfValue(value: Numeric | boolean): Type {
  if (typeof value === "boolean") return BOOL;
  if (isUnitValue(value) || isInstant(value)) return prim(value.kind);
  return NUMBER;
}

import type { Instant, UnitKind, UnitValue } from "./unit.types.js";

/** Anything arithmetic accepts: a plain number, a number carrying a unit, a moment. */
export type Numeric = number | UnitValue | Instant;

/** Why two operands would not combine: the operator, and the kind of each side. */
export type UnitMismatch = { op: string; left: string; right: string };

/**
 * The outcome of {@link combine}: the value, the mismatch behind VN3012, or a
 * divisor of zero, which is VN3030 and not a mismatch of anything.
 */
export type CombineResult =
  | { ok: true; value: Numeric | boolean }
  | { ok: false; mismatch: UnitMismatch }
  | { ok: false; byZero: true };

type Kind = UnitKind | "instant" | "scalar";

type Norm = { kind: Kind; base: number };

const COMPARE = new Set(["<", "<=", ">", ">=", "==", "!="]);

/**
 * Combine two numerics with an operator, checking that their units agree.
 *
 * `300ms + 1s` succeeds; `300ms + 2mb` reports a mismatch. So does a moment:
 * `ended - began` is how long there was between them. Never throws: the caller
 * decides whether a mismatch is a problem and where to point at it.
 *
 * @returns The combined value, or what stopped it.
 */
export function combine(args: { op: string; left: Numeric; right: Numeric }): CombineResult {
  const left = norm(args.left);
  const right = norm(args.right);
  // Asked before the operation rather than after it, because after it the
  // answer is `Infinity` or `NaN` and there is no telling those from a real
  // result. `0s` divides no better than `0`, so it is the base that is asked.
  if (right.base === 0 && (args.op === "/" || args.op === "%")) return { ok: false, byZero: true };
  const value = COMPARE.has(args.op) ? compare(args.op, left, right) : arith(args.op, left, right);
  if (value === null)
    return { ok: false, mismatch: { op: args.op, left: left.kind, right: right.kind } };
  return { ok: true, value };
}

/**
 * Ordering needs a shared unit; equality does not.
 *
 * Asking whether a duration is *less than* a size is a question with no answer,
 * so it reports a mismatch. Asking whether they are *equal* has an obvious one:
 * they are not. Reporting a mismatch there made `a == b` able to fail, so no
 * program could compare two values whose units it did not already know.
 */
function compare(op: string, l: Norm, r: Norm): boolean | null {
  if (l.kind === r.kind) return applyCompare(op, l.base, r.base);
  if (op === "==") return false;
  return op === "!=" ? true : null;
}

function arith(op: string, l: Norm, r: Norm): Numeric | null {
  if (l.kind === "instant" || r.kind === "instant") return moments(op, l, r);
  if (l.kind === "scalar" && r.kind === "scalar") return applyScalar(op, l.base, r.base);
  if (op === "+" || op === "-")
    return l.kind === r.kind ? fromBase(l.kind, applyScalar(op, l.base, r.base)) : null;
  if (op === "*") return scale(l, r);
  return divide(op, l, r);
}

/**
 * The three operations a moment takes part in.
 *
 * A moment minus a moment is how long there was between them, which is the one
 * question two moments answer without being asked anything else. A moment and a
 * length of time give a moment, in either order for `+`. Everything else, a
 * moment times two, a moment plus a plain number, has no answer to give.
 */
function moments(op: string, l: Norm, r: Norm): Numeric | null {
  if (l.kind === "instant" && r.kind === "instant")
    return op === "-" ? fromBase("duration", l.base - r.base) : null;
  if (op === "+" && l.kind === "duration" && r.kind === "instant")
    return fromBase("instant", l.base + r.base);
  if (l.kind !== "instant" || r.kind !== "duration") return null;
  return op === "+" || op === "-" ? fromBase("instant", applyScalar(op, l.base, r.base)) : null;
}

/** A moment rebuilt from milliseconds, with the ISO text arithmetic left it at. */
function instantAt(epochMs: number): Instant {
  const inRange = Number.isFinite(epochMs) && Math.abs(epochMs) <= 8.64e15;
  return { kind: "instant", epochMs, iso: inRange ? new Date(epochMs).toISOString() : "" };
}

function scale(l: Norm, r: Norm): Numeric | null {
  if (l.kind === "scalar") return fromBase(r.kind, l.base * r.base);
  if (r.kind === "scalar") return fromBase(l.kind, l.base * r.base);
  return null;
}

function divide(op: string, l: Norm, r: Norm): Numeric | null {
  if (op !== "/" && op !== "%") return null;
  if (r.kind === "scalar") return fromBase(l.kind, applyScalar(op, l.base, r.base));
  return l.kind === r.kind ? applyScalar(op, l.base, r.base) : null;
}

function norm(value: Numeric): Norm {
  if (typeof value === "number") return { kind: "scalar", base: value };
  if (value.kind === "duration") return { kind: "duration", base: value.ms };
  if (value.kind === "size") return { kind: "size", base: value.bytes };
  if (value.kind === "instant") return { kind: "instant", base: value.epochMs };
  return { kind: "percent", base: value.ratio };
}

function fromBase(kind: Kind, base: number): Numeric {
  if (kind === "instant") return instantAt(base);
  if (kind === "duration") return { kind, ms: base };
  if (kind === "size") return { kind, bytes: base };
  if (kind === "percent") return { kind, ratio: base };
  return base;
}

function applyScalar(op: string, a: number, b: number): number {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (op === "/") return a / b;
  return a % b;
}

function applyCompare(op: string, a: number, b: number): boolean {
  if (op === "<") return a < b;
  if (op === "<=") return a <= b;
  if (op === ">") return a > b;
  if (op === ">=") return a >= b;
  return op === "==" ? a === b : a !== b;
}

import type { UnitKind, UnitValue } from "./unit.types.js";

/** Anything arithmetic accepts: a plain number, or a number carrying a unit. */
export type Numeric = number | UnitValue;

/** Why two operands would not combine: the operator, and the kind of each side. */
export type UnitMismatch = { op: string; left: string; right: string };

/** The outcome of {@link combine}: the value, or the mismatch behind VN3012. */
export type CombineResult =
  | { ok: true; value: Numeric | boolean }
  | { ok: false; mismatch: UnitMismatch };

type Norm = { kind: UnitKind | "scalar"; base: number };

const COMPARE = new Set(["<", "<=", ">", ">=", "==", "!="]);

/**
 * Combine two numerics with an operator, checking that their units agree.
 *
 * `300ms + 1s` succeeds; `300ms + 2mb` reports a mismatch. Never throws: the
 * caller decides whether a mismatch is a problem and where to point at it.
 *
 * @returns The combined value, or the mismatch that stopped it.
 */
export function combine(args: { op: string; left: Numeric; right: Numeric }): CombineResult {
  const left = norm(args.left);
  const right = norm(args.right);
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
  if (l.kind === "scalar" && r.kind === "scalar") return applyScalar(op, l.base, r.base);
  if (op === "+" || op === "-")
    return l.kind === r.kind ? fromBase(l.kind, applyScalar(op, l.base, r.base)) : null;
  if (op === "*") return scale(l, r);
  return divide(op, l, r);
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
  return { kind: "percent", base: value.ratio };
}

function fromBase(kind: UnitKind | "scalar", base: number): Numeric {
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

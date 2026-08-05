import { boundsOutOfOrder, noNumericAnswer } from "../argument-refusal.js";
import { counted, countedOr, numeric } from "../counted-argument.js";
import type { Counted } from "../counted-argument.types.js";
import { type Method, nativeFn } from "../native.types.js";

/** The most decimals a host can render, so anything past it is a mistake. */
const MOST_PLACES = 20;

const PLACES = { what: "number of decimal places", least: 0, most: MOST_PLACES };
const ROUND: Counted = { verb: "round", ...PLACES };
const FIXED: Counted = { verb: "toFixed", ...PLACES };
const TIMES: Counted = { verb: "times", what: "count", least: 0 };
const LOW: Counted = { verb: "clamp", what: "low bound" };
const HIGH: Counted = { verb: "clamp", what: "high bound" };
const EXPONENT: Counted = { verb: "pow", what: "power" };

/** Methods on a number. Rounding and clamping without reaching for a namespace. */
export const NUMBER_METHODS: Record<string, Method> = {
  abs: (value: number) => Math.abs(value),
  floor: (value: number) => Math.floor(value),
  ceil: (value: number) => Math.ceil(value),
  sign: (value: number) => Math.sign(value),
  sqrt: (value: number) => root(value),
  isEven: (value: number) => value % 2 === 0,
  isOdd: (value: number) => Math.abs(value % 2) === 1,
  round: (value: number) => nativeFn((args) => roundTo(value, countedOr(args[0], 0, ROUND))),
  toFixed: (value: number) => nativeFn((args) => value.toFixed(countedOr(args[0], 0, FIXED))),
  clamp: (value: number) =>
    nativeFn((args) => clamp(value, numeric(args[0], LOW), numeric(args[1], HIGH))),
  pow: (value: number) => nativeFn((args) => raised(value, numeric(args[0], EXPONENT))),
  times: (value: number) => Array.from({ length: counted(value, TIMES) }, (_x, i) => i),
  toString: (value: number) => String(value),
};

/** No negative number has a square root, and `NaN` was never the answer to say so. */
function root(value: number): number {
  if (value < 0)
    throw noNumericAnswer(
      `There is no square root of ${value}.`,
      "Take the root of its size, with `.abs.sqrt`.",
    );
  return Math.sqrt(value);
}

/**
 * Held between two bounds, refusing bounds that hold nothing.
 *
 * `(5).clamp(10, 1)` answered `1`: neither bound honoured, and a working clamp
 * to the reader. There is no number both at least 10 and at most 1, so there is
 * no answer to give.
 */
function clamp(value: number, low: number, high: number): number {
  if (low > high) throw boundsOutOfOrder("clamp", low, high);
  return Math.min(Math.max(value, low), high);
}

/**
 * Raised to a power, refusing the pairs that have no number to answer with.
 *
 * `(0).pow(-1)` is a division by zero written the other way, and `(-8).pow(0.5)`
 * asks for a root that is not on the number line. Both used to answer, one with
 * `Infinity` and one with `NaN`.
 */
function raised(value: number, exponent: number): number {
  const result = value ** exponent;
  if (Number.isFinite(result)) return result;
  throw noNumericAnswer(`There is no answer to ${value} raised to ${exponent}.`);
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

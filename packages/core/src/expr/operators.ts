import { buildProblem, CODES } from "../codes/index.js";
import { ProblemError, UNLOCATED } from "../problem/index.js";
import { combine, type Numeric } from "../units/index.js";
import { isNumeric, strictEquals } from "../value/index.js";
import { isPattern } from "./methods/regex-methods.js";
import { operatorRefusal } from "./operator-refusal.js";
import { isWaiting, whenBothReady } from "./pending.js";

/**
 * Two plain numbers, where the unit machinery has nothing to decide. Going
 * through `combine` for `x + 1` normalises both sides into fresh objects and
 * asks whether their units agree, which for scalars is always yes.
 *
 * The compiler looks the operator up here once, so at run time this is a
 * captured function rather than a table read.
 */
export const PLAIN: Record<string, (a: number, b: number) => number | boolean> = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
  "%": (a, b) => a % b,
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
};

/**
 * Apply a binary operator to two values of any kind.
 *
 * @throws ProblemError VN3012 when the units do not agree, or when the operator
 * has no meaning for these values.
 */
export function applyBinary(op: string, left: unknown, right: unknown): unknown {
  // Only on the slow path: two plain numbers never reach here. Either side may
  // still be on its way, in which case the answer is too.
  if (isWaiting(left) || isWaiting(right)) {
    return whenBothReady(left, right, (a, b) => applyBinary(op, a, b));
  }
  if (op === "in") return isIn(left, right);
  if (op === "~=") return regexMatch(left, right);
  if (isNumeric(left) && isNumeric(right)) return numeric(op, left, right);
  if (op === "==") return strictEquals(left, right);
  if (op === "!=") return !strictEquals(left, right);
  throw operatorRefusal({ op, left, right });
}

/** Negate a numeric, keeping its unit. */
export function negate(value: Numeric): unknown {
  const result = combine({ op: "*", left: value, right: -1 });
  return result.ok ? result.value : value;
}

function numeric(op: string, left: Numeric, right: Numeric): unknown {
  const result = combine({ op, left, right });
  if (result.ok) return result.value;
  if ("byZero" in result) throw dividedByZero(op);
  throw new ProblemError(
    buildProblem({
      spec: CODES.VN3012_UNIT_MISMATCH,
      span: UNLOCATED,
      title: `Cannot combine ${result.mismatch.left} with ${result.mismatch.right} using "${op}".`,
    }),
  );
}

/**
 * `VN3030` for a divisor of zero, which used to answer `Infinity` or `NaN`.
 *
 * Both are values and both survive every sum after them, so the program went on
 * and printed a plausible wrong number. There is no number that is `1 / 0`, and
 * a caller who wrote one wants to know at the division.
 *
 * The help names `try` first and the guard only as prose, because this language
 * scopes a binding to its block: `if b != 0 { const rate = a / b }` moves the
 * name out of the scope that reads it, so a reader who followed a `{ … }` here
 * got `null` and exit 0, which is the silence this code exists to end. A `try`
 * stands where the division stands and takes nothing with it.
 */
function dividedByZero(op: string): ProblemError {
  const what = op === "%" ? "remainder" : "quotient";
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3030_NO_NUMERIC_ANSWER,
      span: UNLOCATED,
      title: `Dividing by zero has no ${what}.`,
      help: "Give it a stand-in with `try a / b else 0`, or check the divisor before you divide.",
    }),
  );
}

function isIn(left: unknown, right: unknown): boolean {
  if (Array.isArray(right)) return right.includes(left);
  if (typeof right === "string") return right.includes(String(left));
  return false;
}

/**
 * `subject ~= pattern`, where the pattern is a compiled one or the text of one.
 *
 * Text still works, because every `~=` written before patterns existed passes
 * text and none of them should break. A compiled pattern is the better spelling
 * where the same one is used more than once: it compiles where it is written
 * rather than on every comparison.
 *
 * `r"…"` is how the text of one is written, since a raw string keeps every
 * backslash, and flags go inside it: `r"(?i:order #\d+)"`.
 */
function regexMatch(subject: unknown, value: unknown): boolean {
  const found = isPattern(value) ? value.compiled : compile(String(value));
  return found.test(String(subject));
}

function compile(source: string): RegExp {
  try {
    return new RegExp(source);
  } catch (error) {
    throw badPattern(source, error);
  }
}

function badPattern(source: string, error: unknown): ProblemError {
  const why =
    error instanceof Error ? error.message.replace(/^Invalid regular expression: /, "") : "";
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3018_BAD_PATTERN,
      span: UNLOCATED,
      title: `This is not a pattern \`~=\` can use: ${source}. ${why}`.trim(),
    }),
  );
}

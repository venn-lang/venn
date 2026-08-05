import { buildProblem, CODES } from "../codes/index.js";
import { ProblemError, UNLOCATED } from "../problem/index.js";
import { combine, type Numeric } from "../units/index.js";
import { isNumeric, strictEquals } from "../value/index.js";
import { isPattern } from "./methods/regex-methods.js";
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
  throw operatorError(op);
}

/** Negate a numeric, keeping its unit. */
export function negate(value: Numeric): unknown {
  const result = combine({ op: "*", left: value, right: -1 });
  return result.ok ? result.value : value;
}

function numeric(op: string, left: Numeric, right: Numeric): unknown {
  const result = combine({ op, left, right });
  if (result.ok) return result.value;
  throw new ProblemError(
    buildProblem({
      spec: CODES.VN3012_UNIT_MISMATCH,
      span: UNLOCATED,
      title: `Cannot combine ${result.mismatch.left} with ${result.mismatch.right} using "${op}".`,
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

function operatorError(op: string): ProblemError {
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3012_UNIT_MISMATCH,
      span: UNLOCATED,
      title: `Operator "${op}" cannot be applied to these values.`,
    }),
  );
}

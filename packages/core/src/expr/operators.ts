import { buildProblem, CODES } from "../codes/index.js";
import { ProblemError } from "../problem/index.js";
import { combine, type Numeric } from "../units/index.js";
import { isNumeric, strictEquals } from "../value/index.js";
import { isWaiting, whenBothReady } from "./pending.js";

const NO_SPAN = { uri: "", offset: 0, length: 0, line: 1, column: 1 };

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
      span: NO_SPAN,
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
 * `subject ~= pattern`, where the pattern is text.
 *
 * A pattern that does not compile used to answer `false`, which reads as "it did
 * not match" and sends whoever wrote it looking at the subject. It is the
 * pattern that is wrong, and there is no answer to give.
 *
 * `r"…"` is the form to write one in, since a raw string keeps every backslash.
 * Flags go inside it: `r"(?i:order #\d+)"`.
 */
function regexMatch(subject: unknown, pattern: unknown): boolean {
  const source = String(pattern);
  return compile(source).test(String(subject));
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
      span: NO_SPAN,
      title: `This is not a pattern \`~=\` can use: ${source}. ${why}`.trim(),
    }),
  );
}

function operatorError(op: string): ProblemError {
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3012_UNIT_MISMATCH,
      span: NO_SPAN,
      title: `Operator "${op}" cannot be applied to these values.`,
    }),
  );
}

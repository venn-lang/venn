/**
 * What a compiled `repeat` or `forEach` does with a bound it cannot use.
 *
 * The scheduler refuses the same two values with the same two codes, and this is
 * the other half of it: a body inside a `fn` is compiled, so there is no engine
 * to ask and no document URI to point at. The span is read off the node while
 * the body compiles and kept in the closure, which leaves the URI empty and
 * everything else exact, the way every Problem raised from inside the kernel
 * already reads.
 */

import { buildProblem, CODES } from "../../codes/index.js";
import { typeName } from "../../expr/prelude.js";
import type { Expr } from "../../generated/ast.js";
import { ProblemError, type Span } from "../../problem/index.js";

/**
 * How many passes a `repeat` runs, refusing a count that is not a number.
 *
 * @param node The counting expression, for the span the refusal points at.
 * @returns A check over the evaluated count. Zero and below mean "not at all".
 * @throws {ProblemError} `VN3016` when the value is not a finite number.
 */
export function checkedCount(node: Expr): (value: unknown) => number {
  const span = spanOf(node);
  return (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) throw notANumber(span, value);
    return value > 0 ? Math.floor(value) : 0;
  };
}

/**
 * What a `forEach` walks, refusing a source that is not a list.
 *
 * @param node The source expression, for the span the refusal points at.
 * @returns A check over the evaluated source.
 * @throws {ProblemError} `VN3015` when the value is not a list.
 */
export function checkedList(node: Expr): (value: unknown) => readonly unknown[] {
  const span = spanOf(node);
  return (value) => {
    if (!Array.isArray(value)) throw notAList(span, value);
    return value;
  };
}

/**
 * A count the machine cannot read as one is refused, because running the body
 * zero times would report success: `repeat cfg.times` with nothing behind
 * `times` would check nothing and pass. The sentence matches the scheduler's,
 * because one fact said two ways is how the two paths start to drift.
 */
function notANumber(span: Span, value: unknown): ProblemError {
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3016_NOT_A_NUMBER,
      span,
      title: `repeat needs a number of times, and this is a ${typeName(value)}.`,
      help: "Give it a count, as in `repeat 3 { … }`.",
    }),
  );
}

/**
 * Anything but a list is refused, because iterating it zero times would report
 * success: a test that checked nothing, dressed as one that passed.
 */
function notAList(span: Span, value: unknown): ProblemError {
  const kind = typeName(value);
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3015_NOT_A_LIST,
      span,
      title: `forEach needs a list, and this is a ${kind}.`,
      // The everyday cause: an endpoint answering `{ data: [...] }` rather than a list.
      help:
        kind === "map" ? "Name the list inside it, as in `forEach item in res.data`." : undefined,
    }),
  );
}

/** Where the node sits in its file. The URI is the one thing a body cannot know. */
function spanOf(node: Expr): Span {
  const cst = node.$cstNode;
  const start = cst?.range?.start;
  return {
    uri: "",
    offset: cst?.offset ?? 0,
    length: cst?.length ?? 0,
    line: (start?.line ?? 0) + 1,
    column: (start?.character ?? 0) + 1,
  };
}

import { docsFor } from "./docs-for.js";
import { UNKNOWN_CODE } from "./problem-of.js";
import type { Span } from "./span.types.js";
import { spanIn } from "./span-in.js";
import type { Thrown } from "./thrown.types.js";

/**
 * A failure as a value a program can read.
 *
 * Drawn from the `Problem` every failure already is, and deliberately not all of
 * it: what is here is what a program can act on. The flow trace is not, because
 * it holds spans of files the program may never have opened.
 *
 * `null` and never `undefined` for what a failure did not carry: the language
 * has one nothing, and a program comparing `e.help == null` has to be able to
 * ask about it.
 */
export interface Caught {
  code: string;
  message: string;
  where: string | null;
  help: string | null;
  docs: string | null;
  /** Whatever the `fail` that raised it attached, and nothing otherwise. */
  data: unknown;
}

/**
 * What `catch` binds, from whatever was thrown.
 *
 * A `ProblemError` keeps its code inside the problem and a `VennError` keeps it
 * on itself, so both are asked. Reading only the second handed `VN7000` back for
 * every failure the compiler raises, which is most of them.
 *
 * A code is taken as it comes, unlike the one a reporter renders: `e.code ==
 * "pay.declined"` is the whole point of the field, nothing downstream of a
 * program promises it is catalogued, and a program that met an `ENOENT` is
 * better off being told so than being handed `VN7000`.
 *
 * The link comes from that same code rather than from whatever made the
 * failure. A `VennError` a plugin threw carries a code and no problem at all,
 * so reading the link off the problem left the whole VN7xxx surface without
 * one: `catch e { print e.docs }` printed a URL for a `fail` and nothing for a
 * failed `json.parse`, one line apart, and a program could not tell why.
 *
 * Nothing is unwrapped on the way through. A secret redacts itself when it is
 * serialised, so a secret that reached a failure is still redacted when the
 * program reads it back out of one.
 *
 * @param failure Whatever unwound: a `VennError`, a `ProblemError`, or
 * something from below the language.
 * @returns The failure as the `error` type the prelude publishes.
 */
export function caughtValue(failure: unknown): Caught {
  const held = failure as Thrown | undefined;
  const problem = held?.problem;
  const code = problem?.code ?? held?.code ?? UNKNOWN_CODE;
  return {
    code,
    message: held?.message ?? String(failure),
    where: placeOf(problem?.span ?? spanIn(held?.detail)),
    help: problem?.help ?? null,
    docs: docsFor(code) ?? null,
    data: held?.detail?.data ?? null,
  };
}

/** Where it happened, as it reads in a report: `orders.vn:12:5`. */
function placeOf(span: Span | undefined): string | null {
  if (!span?.uri) return null;
  return `${span.uri}:${span.line}:${span.column}`;
}

/**
 * Whether this is a failure rather than the program leaving.
 *
 * A control signal is deliberately not an `Error`: `break`, `continue`,
 * `return` and `exit` are the program going where it was told, and catching one
 * would turn a loop's `break` into a failed attempt.
 */
export function isFailure(thrown: unknown): boolean {
  return thrown instanceof Error;
}

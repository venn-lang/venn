import type { Problem } from "./problem.types.js";
import type { Span } from "./span.types.js";

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

/** The default for a failure that carried no code of its own. */
const UNKNOWN = "VN7000";

/** What a thrown value may be carrying, whoever threw it. */
interface Thrown {
  message?: string;
  code?: string;
  problem?: Problem;
  detail?: { data?: unknown; where?: Span };
}

/**
 * What `catch` binds, from whatever was thrown.
 *
 * A `ProblemError` keeps its code inside the problem and a `VennError` keeps it
 * on itself, so both are asked. Reading only the second handed `VN7000` back for
 * every failure the compiler raises, which is most of them.
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
  return {
    code: problem?.code ?? held?.code ?? UNKNOWN,
    message: held?.message ?? String(failure),
    where: placeOf(problem?.span ?? held?.detail?.where),
    help: problem?.help ?? null,
    docs: problem?.docs ?? null,
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

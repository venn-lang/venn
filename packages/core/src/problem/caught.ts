import type { Problem } from "./problem.types.js";

/**
 * A failure as a value a program can read.
 *
 * Two fields for now, which is what `catch` has always handed over. What §16
 * promises is a great deal more, and reaching it is #161; this is where that
 * will happen, in one place, rather than in each of the two that build it today.
 */
export interface Caught {
  message: string;
  code: string;
}

/** The default for a failure that carried no code of its own. */
const UNKNOWN = "VN7000";

/**
 * What `catch` binds, from whatever was thrown.
 *
 * A `ProblemError` keeps its code inside the problem and a `VennError` keeps it
 * on itself, so both are asked. Reading only the second handed `VN7000` back for
 * every failure the compiler raises, which is most of them.
 *
 * @param failure Whatever unwound: a `VennError`, a `ProblemError`, or
 * something from below the language.
 * @returns Its message and its code, never `undefined` for either.
 */
export function caughtValue(failure: unknown): Caught {
  const held = failure as { message?: string; code?: string; problem?: Problem } | undefined;
  return {
    message: held?.message ?? String(failure),
    code: held?.problem?.code ?? held?.code ?? UNKNOWN,
  };
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

import { type EvalEnv, evaluate, type MapEntry } from "@venn-lang/core";

/**
 * What an entry reads as when only a run could know its value.
 *
 * Its own value, because `null` is a value and the two answers used to be one.
 * The compiler makes an unbound name evaluate to `null`, deliberately: the
 * language has one nothing, and a name nobody bound reads as it. So the result
 * cannot say which happened, and a written `null` checked clean on all six
 * duration keys that `venn run` refuses on the line that wrote them.
 */
export const UNKNOWABLE: unique symbol = Symbol("venn.unknowable");

/**
 * What an options entry says, when it says it here.
 *
 * Evaluated against nothing, so a literal answers and anything reaching for a
 * name reads as nothing at all. A value the checker cannot know is one only the
 * run can hold to its domain, and guessing at it would squiggle the innocent:
 * `{ concurrency: pool }` is a name, not a mistake.
 *
 * Which of the two happened is read from the environment rather than from the
 * answer: nothing is bound here, so a lookup at all is the expression reaching
 * for something this pass cannot see.
 *
 * @param entry The written entry.
 * @returns The value it evaluates to on its own, or {@link UNKNOWABLE} when it
 * needs a running program to have one.
 */
export function writtenValue(entry: MapEntry): unknown {
  let reached = false;
  const nothing: EvalEnv = {
    lookup: () => {
      reached = true;
      return undefined;
    },
  };
  try {
    const held: unknown = evaluate(entry.value, nothing);
    return reached ? UNKNOWABLE : held;
  } catch {
    return UNKNOWABLE;
  }
}

import type { ParamSpec } from "@venn-lang/sdk";

/**
 * What `parallel`, `race` and `forEach` accept between their braces, keyed by
 * the node type that carries them.
 *
 * One list, two readers, exactly as an action's options already work: the
 * checker squiggles a stray key before anything runs and the runtime refuses it
 * when the line executes. Every key here used to be accepted in silence, and
 * `onError: "collct"` read as the opposite of the default, so one wrong letter
 * inverted the semantics with no diagnostic either way.
 *
 * A `ParamSpec` and not a shape of its own, because that is what the did-you-mean
 * already speaks.
 */
export const CONSTRUCT_OPTIONS: Readonly<Record<string, readonly ParamSpec[]>> = {
  ParallelStmt: [
    { name: "concurrency", type: "number", required: false },
    { name: "onError", type: "string", required: false, values: ["cancel", "collect"] },
  ],
  RaceStmt: [{ name: "timeout", type: "duration", required: false }],
  ForEachStmt: [{ name: "concurrency", type: "number", required: false }],
};

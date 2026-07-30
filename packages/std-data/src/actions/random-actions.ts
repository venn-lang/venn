import {
  type ActionDefinition,
  type ActionInput,
  arg,
  defineAction,
  restArg,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { rng, shuffleWith } from "../rng/index.js";

/** `data.oneOf("free", "pro")`: pick one of the given values via the shared PRNG. */
export const oneOf: ActionDefinition = defineAction({
  name: "oneOf",
  doc: "Pick one of the given values deterministically.",
  // Polymorphic: whatever goes in is what comes back, so `data.oneOf("a", "b")`
  // is a string to the checker rather than something it knows nothing about.
  args: [restArg("choices", t.param("T"), "The candidates. One of them comes back.")],
  result: t.param("T"),
  run: (_ctx, input) => input.args[Math.floor(rng() * input.args.length)],
});

/** `data.range(1, 10)`: a deterministic integer in the inclusive range [min, max]. */
export const range: ActionDefinition = defineAction({
  name: "range",
  doc: "A deterministic integer within the inclusive range [min, max].",
  args: [
    arg("min", t.number, "The lowest it may be, included."),
    arg("max", t.number, "The highest it may be, included."),
  ],
  result: t.number,
  run: (_ctx, input) => integerInRange(input),
});

function integerInRange(input: ActionInput<unknown>): number {
  const min = Math.trunc(Number(input.args[0] ?? 0));
  const max = Math.trunc(Number(input.args[1] ?? 0));
  return min + Math.floor(rng() * (max - min + 1));
}

/** `data.shuffle([1, 2, 3])`: a deterministic permutation of the given array. */
export const shuffle: ActionDefinition = defineAction({
  name: "shuffle",
  doc: "A deterministic shuffle of the given array.",
  // Elements come back unchanged, only reordered, and the signature says so: a
  // shuffled `list<string>` is still a `list<string>`.
  args: [arg("values", t.list(t.param("T")), "What to shuffle. The original is left alone.")],
  result: t.list(t.param("T")),
  run: (_ctx, input) => shuffleWith(toArray(input.args[0]), rng),
});

function toArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

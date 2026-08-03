import { VennError } from "@venn-lang/contracts";
import {
  type ActionDefinition,
  type ActionInput,
  arg,
  defineAction,
  PLUGIN_CODES,
  restArg,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { type Rng, rngFrom, shuffleWith } from "../rng/index.js";

/** `data.oneOf("free", "pro")`: pick one of the given values from the run's stream. */
export const oneOf: ActionDefinition = defineAction({
  name: "oneOf",
  doc: "Pick one of the given values deterministically.",
  // Polymorphic: whatever goes in is what comes back, so `data.oneOf("a", "b")`
  // is a string to the checker rather than something it knows nothing about.
  args: [restArg("choices", t.param("T"), "The candidates. One of them comes back.")],
  result: t.param("T"),
  run: (ctx, input) => picked(input.args, rngFrom(ctx)),
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
  run: (ctx, input) => integerInRange(input, rngFrom(ctx)),
});

/**
 * One of the candidates, or a refusal when there are none.
 *
 * Picking from nothing answered with nothing, which is not a value the caller
 * asked for: it is the call being impossible, and that is a mistake in the
 * program rather than a result.
 */
function picked(choices: readonly unknown[], rng: Rng): unknown {
  if (choices.length === 0) throw refuses("`data.oneOf` needs something to choose from.");
  return choices[Math.floor(rng() * choices.length)];
}

/**
 * A range whose end is below its start is not a range. It answered with a
 * number outside both ends, silently, which is the worst of the three answers a
 * verb can give.
 */
function integerInRange(input: ActionInput<unknown>, rng: Rng): number {
  const min = Math.trunc(Number(input.args[0] ?? 0));
  const max = Math.trunc(Number(input.args[1] ?? 0));
  if (max < min) throw refuses(`There is no range from ${min} to ${max}.`);
  return min + Math.floor(rng() * (max - min + 1));
}

function refuses(message: string): VennError {
  return new VennError({ code: PLUGIN_CODES.VN7005_BAD_ARGUMENT, message });
}

/** `data.shuffle([1, 2, 3])`: a deterministic permutation of the given array. */
export const shuffle: ActionDefinition = defineAction({
  name: "shuffle",
  doc: "A deterministic shuffle of the given array.",
  // Elements come back unchanged, only reordered, and the signature says so: a
  // shuffled `list<string>` is still a `list<string>`.
  args: [arg("values", t.list(t.param("T")), "What to shuffle. The original is left alone.")],
  result: t.list(t.param("T")),
  run: (ctx, input) => shuffleWith(toArray(input.args[0]), rngFrom(ctx)),
});

function toArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

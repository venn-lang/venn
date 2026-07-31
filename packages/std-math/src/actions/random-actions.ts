import { RandomPort } from "@venn-lang/contracts";
import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

/**
 * Randomness, from the host rather than from here.
 *
 * The host binds a seeded source, so the same run draws the same numbers twice
 * and a failure can be replayed. A plugin that reached for `Math.random` would
 * take that away from every test that uses it.
 */
export const randomActions: ActionDefinition[] = [
  defineAction({
    name: "random",
    doc: "A number from 0 up to but not including 1, from the run's own source.",
    result: t.number,
    run: (ctx) => ctx.port(RandomPort).next(),
  }),
  defineAction({
    name: "randomInt",
    doc: "A whole number between two others, both ends included.",
    args: [arg("from", t.number, "The lowest it may be."), arg("to", t.number, "The highest.")],
    result: t.number,
    run: (ctx, input) =>
      ctx.port(RandomPort).int(Number(input.args[0] ?? 0), Number(input.args[1] ?? 0)),
  }),
];

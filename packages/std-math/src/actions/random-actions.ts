import { RandomPort, VennError } from "@venn-lang/contracts";
import {
  type ActionContext,
  type ActionDefinition,
  arg,
  defineAction,
  PLUGIN_CODES,
} from "@venn-lang/sdk";
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
    run: (ctx, input) => whole(ctx, input.args),
  }),
];

/**
 * A whole number between two others, or a refusal.
 *
 * A range whose end is below its start is not a range, and the port answers one
 * outside both ends rather than saying so. Refused here, where the verb is, so
 * the program hears about it at the call it wrote.
 */
function whole(ctx: ActionContext, args: readonly unknown[]): number {
  const from = Number(args[0] ?? 0);
  const to = Number(args[1] ?? 0);
  if (to < from) {
    throw new VennError({
      code: PLUGIN_CODES.VN7005_BAD_ARGUMENT,
      message: `There is no range from ${from} to ${to}.`,
    });
  }
  return ctx.port(RandomPort).int(from, to);
}

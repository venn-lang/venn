import { type ActionDefinition, arg, defineAction, optionalArg } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

const of = (value: unknown): number => Number(value ?? 0);

/**
 * The questions a number cannot answer about itself, because the answer is about
 * what it is rather than about its value.
 *
 * `nan` is the reason: it equals nothing, itself included, so `x == math.nan` is
 * false however wrong the sum went. Asking has to be a verb.
 *
 * All three are `pure`. They read `input.args` and nothing else, so they are
 * refused inside a `fn` only because `math.random` shares their namespace, and
 * `math.isClose` is exactly the sort of thing a pure body wants: the whole point
 * of `examples/basics/11-math.vn`'s float comparison is that it is a question
 * about two numbers you already have.
 */
export const checks: ActionDefinition[] = [
  defineAction({
    name: "isNaN",
    doc: "Whether this is the not-a-number, which no comparison can find.",
    args: [arg("value", t.number, "The number to ask about.")],
    result: t.bool,
    pure: true,
    run: (_ctx, input) => Number.isNaN(of(input.args[0])),
  }),
  defineAction({
    name: "isFinite",
    doc: "Whether it is a real number: not infinite, and not a mistake.",
    args: [arg("value", t.number, "The number to ask about.")],
    result: t.bool,
    pure: true,
    run: (_ctx, input) => Number.isFinite(of(input.args[0])),
  }),
  defineAction({
    name: "isClose",
    doc: "Whether two numbers are near enough, which is the only fair question about floats.",
    args: [
      arg("a", t.number, "One of them."),
      arg("b", t.number, "The other."),
      optionalArg("within", t.number, "How far apart they may be. A very small number by default."),
    ],
    result: t.bool,
    pure: true,
    run: (_ctx, input) => close(of(input.args[0]), of(input.args[1]), input.args[2]),
  }),
];

/**
 * Near enough, by a tolerance that scales with the numbers themselves.
 *
 * A fixed difference is wrong at both ends: everything is within `0.001` of a
 * billion, and nothing is within it of a millionth.
 */
function close(a: number, b: number, within: unknown): boolean {
  const gap = Math.abs(a - b);
  if (within !== undefined && within !== null) return gap <= Number(within);
  return gap <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 4;
}

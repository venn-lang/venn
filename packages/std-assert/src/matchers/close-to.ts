import { arg, defineMatcher, type MatcherDefinition, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { failureLine } from "./failure-line.js";

const DEFAULT_WITHIN = 0.01;

/** `expect x closeTo 99.0 { within: 0.01 }`: numeric equality within a tolerance. */
export const closeTo: MatcherDefinition = defineMatcher({
  name: "closeTo",
  args: [arg("value", t.number, "The number to come near. `within` in the options sets how near.")],
  params: z.object({ within: z.number().default(DEFAULT_WITHIN) }),
  test: ({ subject, args, params }) =>
    Math.abs(Number(subject) - Number(args[0])) <= tolerance(params),
  // The tolerance belongs in the title: without it a failure cannot be judged.
  message: ({ subject, args, params }, { show }) =>
    failureLine({
      subject,
      relation: `to be within ${tolerance(params)} of`,
      other: args[0],
      show,
    }),
  detail: ({ subject, args }) => ({ expected: args[0], actual: subject }),
});

function tolerance(params: unknown): number {
  return (params as { within?: number }).within ?? DEFAULT_WITHIN;
}

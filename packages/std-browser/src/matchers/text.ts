import { arg, defineMatcher, type MatcherDefinition } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

/**
 * `expect element text "Order confirmed"`.
 *
 * Passes when the element's text equals or contains the expected string.
 * Containment is deliberate: assertions about copy should survive a stray
 * space or a wrapping node.
 */
export const text: MatcherDefinition = defineMatcher({
  name: "text",
  args: [arg("value", t.string, "The text the element should carry.")],
  appliesTo: "Element",
  test: ({ subject, args }) => matchesText(subject, String(args[0])),
  message: ({ args }, ctx) => `expected the element text to contain "${ctx.show(args[0])}"`,
});

function matchesText(subject: unknown, expected: string): boolean {
  const actual = (subject as { text?: string } | null)?.text ?? "";
  return actual === expected || actual.includes(expected);
}

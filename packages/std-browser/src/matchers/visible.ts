import { defineMatcher, type MatcherDefinition } from "@venn-lang/sdk";

/**
 * `expect element visible`.
 *
 * Passes when the element is on screen. An element that is absent, or whose
 * subject is not an element at all, fails rather than erroring.
 */
export const visible: MatcherDefinition = defineMatcher({
  name: "visible",
  appliesTo: "Element",
  test: ({ subject }) => isVisible(subject),
  message: () => "expected the element to be visible",
});

function isVisible(subject: unknown): boolean {
  return (subject as { visible?: boolean } | null)?.visible === true;
}

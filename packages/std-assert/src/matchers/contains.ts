import { arg, defineMatcher, type MatcherDefinition } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { deepEquals } from "./deep-equals.js";
import { failureLine } from "./failure-line.js";

/** `expect x contains y`: substring for strings, membership for lists. */
export const contains: MatcherDefinition = defineMatcher({
  name: "contains",
  args: [arg("value", t.dynamic, "What to look for: a substring, or an item of the list.")],
  test: ({ subject, args }) => includes(subject, args[0]),
  message: ({ subject, args }, { show }) =>
    failureLine({ subject, relation: "to contain", other: args[0], show }),
  // `aligned: false`: the needle is held against every item, never against item
  // 0, so the two sides do not correspond by position.
  detail: ({ subject, args }) => ({ expected: args[0], actual: subject, aligned: false }),
});

function includes(subject: unknown, value: unknown): boolean {
  if (typeof subject === "string") return subject.includes(String(value));
  if (Array.isArray(subject)) return subject.some((item) => deepEquals(item, value));
  return false;
}

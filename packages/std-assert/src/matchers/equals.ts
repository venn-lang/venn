import { arg, defineMatcher, type MatcherDefinition } from "@venn/sdk";
import { t } from "@venn/types";
import { deepEquals } from "./deep-equals.js";
import { failureLine } from "./failure-line.js";

/** `expect x equals y`: the same value, no coercion, maps and lists included. */
export const equals: MatcherDefinition = defineMatcher({
  name: "equals",
  args: [arg("value", t.dynamic, "What the subject should be, compared field by field.")],
  test: ({ subject, args }) => deepEquals(subject, args[0]),
  message: ({ subject, args }) => failureLine({ subject, relation: "to equal", other: args[0] }),
  detail: ({ subject, args }) => ({ expected: args[0], actual: subject }),
});

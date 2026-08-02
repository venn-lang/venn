import { arg, defineMatcher, type MatcherDefinition } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { deepEquals } from "./deep-equals.js";
import { failureLine } from "./failure-line.js";

/** `expect x oneOf [a, b]`: passes if the subject is one of the options. */
export const oneOf: MatcherDefinition = defineMatcher({
  name: "oneOf",
  args: [arg("values", t.list(t.dynamic), "The accepted values. The subject must be one of them.")],
  test: ({ subject, args }) => options(args[0]).some((option) => deepEquals(option, subject)),
  message: ({ subject, args }, { show }) =>
    failureLine({ subject, relation: "to be one of", other: args[0], show }),
  // The subject is held against every option, never against one by position.
  detail: ({ subject, args }) => ({ expected: args[0], actual: subject, aligned: false }),
});

function options(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

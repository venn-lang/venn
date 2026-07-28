import { arg, defineMatcher, type MatcherDefinition, optionalArg } from "@venn/sdk";
import { t } from "@venn/types";

/**
 * `expect res header "content-type"`: passes if the response carries the header.
 *
 * The lookup is case-insensitive, because header casing is whatever the far end
 * happened to send.
 */
export const header: MatcherDefinition = defineMatcher({
  name: "header",
  args: [
    arg("name", t.string, "Which header to read."),
    optionalArg(
      "value",
      t.string,
      "What it should say. Omit it to check the header is merely present.",
    ),
  ],
  appliesTo: "Response",
  test: ({ subject, args }) => hasHeader(subject, String(args[0])),
  message: ({ args }) => `expected the response to carry header "${String(args[0])}"`,
});

function hasHeader(subject: unknown, name: string): boolean {
  const headers = (subject as { headers?: Record<string, string> }).headers ?? {};
  const target = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

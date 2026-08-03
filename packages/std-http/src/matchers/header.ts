import { arg, defineMatcher, type MatcherDefinition, optionalArg } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

/**
 * `expect res header "content-type"`: passes if the response carries the header.
 *
 * Given a second argument it compares the value as well. It used to declare that
 * argument, document it, and never read it, so `expect res header "content-type"
 * "text/plain; charset=utf-42"` passed against `application/json`: a green
 * assertion that asserted nothing.
 *
 * The name is matched case-insensitively, because header casing is whatever the
 * far end happened to send. The value is matched exactly, because that is what
 * the caller wrote down.
 */
export const header: MatcherDefinition = defineMatcher({
  name: "header",
  args: [
    arg("name", t.string, "Which header to read."),
    optionalArg(
      "value",
      t.string,
      "What it should say, matched exactly. Omit it to check the header is merely present.",
    ),
  ],
  appliesTo: "Response",
  test: ({ subject, args }) => matches(subject, args),
  message: ({ args }, ctx) => said(args, ctx.show(args[0])),
  detail: ({ subject, args }) => ({
    expected: args[1] ?? "the header to be there",
    actual: headerValue(subject, String(args[0])) ?? "nothing",
  }),
});

/** The one line, which says whether a value was asked for or only the header. */
function said(args: readonly unknown[], name: string): string {
  if (args[1] === undefined) return `expected the response to carry header "${name}"`;
  return `expected header "${name}" to say "${String(args[1])}"`;
}

function matches(subject: unknown, args: readonly unknown[]): boolean {
  const found = headerValue(subject, String(args[0]));
  if (found === undefined) return false;
  return args[1] === undefined || found === String(args[1]);
}

/** What the response said for that header, whatever case it spelled it in. */
function headerValue(subject: unknown, name: string): string | undefined {
  const headers = (subject as { headers?: Record<string, string> }).headers ?? {};
  const target = name.toLowerCase();
  const key = Object.keys(headers).find((one) => one.toLowerCase() === target);
  return key === undefined ? undefined : headers[key];
}

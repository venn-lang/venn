import { arg, defineMatcher, type MatcherDefinition } from "@venn/sdk";
import { t } from "@venn/types";

/** `expect res type "ack"`: passes if the message carries exactly that `type`. */
export const ofType: MatcherDefinition = defineMatcher({
  name: "type",
  args: [arg("type", t.string, "The message type expected: `text`, `binary`.")],
  appliesTo: "Message",
  test: ({ subject, args }) => messageType(subject) === String(args[0]),
  message: ({ args }) => `expected the message to have type "${String(args[0])}"`,
});

function messageType(subject: unknown): string | undefined {
  return (subject as { type?: string }).type;
}

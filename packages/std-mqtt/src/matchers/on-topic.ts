import { arg, defineMatcher, type MatcherDefinition } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

/**
 * `expect res topic "inventory/ack"`: passes if the message arrived on exactly
 * that topic. The comparison is literal, so wildcards are not expanded here.
 */
export const onTopic: MatcherDefinition = defineMatcher({
  name: "topic",
  args: [arg("topic", t.string, "The topic the message should have arrived on.")],
  appliesTo: "Message",
  test: ({ subject, args }) => messageTopic(subject) === String(args[0]),
  message: ({ args }) => `expected the message on topic "${String(args[0])}"`,
});

function messageTopic(subject: unknown): string | undefined {
  return (subject as { topic?: string }).topic;
}

import { type ActionDefinition, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { NotifierPort } from "../port/index.js";

const params = z.object({ mention: z.string().optional() }).optional();

/**
 * `notify.slack "#qa" { mention: "@oncall" }`.
 *
 * Posts to a Slack channel or a user. `mention` pings someone alongside the post.
 *
 * @returns a `notify.Receipt`.
 */
export const slack: ActionDefinition = defineAction({
  name: "slack",
  doc: "Send a Slack notification to a channel.",
  params,
  args: [arg("channel", t.string, "Where to post: `#builds`, or a user.")],
  result: t.ref("notify.Receipt"),
  run: (ctx, input) =>
    ctx.port(NotifierPort).send({
      kind: "slack",
      channel: String(input.args[0] ?? ""),
      mention: input.params?.mention,
    }),
});

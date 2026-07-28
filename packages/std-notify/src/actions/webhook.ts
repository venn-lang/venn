import { type ActionDefinition, arg, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { NotifierPort } from "../port/index.js";

const params = z.object({ json: z.unknown().optional() }).optional();

/**
 * `notify.webhook "https://hooks.example.com/build" { json: { status: "red" } }`.
 *
 * Posts a JSON payload to a URL. The payload rides in `json` and is sent as is.
 *
 * @returns a `notify.Receipt`.
 */
export const webhook: ActionDefinition = defineAction({
  name: "webhook",
  doc: "Send a webhook notification with a JSON body.",
  params,
  args: [arg("url", t.string, "Where to post the JSON body.")],
  result: t.ref("notify.Receipt"),
  run: (ctx, input) =>
    ctx.port(NotifierPort).send({
      kind: "webhook",
      channel: String(input.args[0] ?? ""),
      json: input.params?.json,
    }),
});

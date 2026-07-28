import { type ActionDefinition, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { WsClientPort } from "../port/index.js";

const params = z.object({
  type: z.string().optional(),
  where: z.record(z.string(), z.unknown()).optional(),
});

/**
 * `ws.expect { type: "ack" }` or `ws.expect { where: { … } }`: wait for the next
 * message that matches.
 *
 * The query is the options map, so nothing is positional. The result is typed as
 * `ws.Message`, which is what lets `expect res type "ack"` know its subject.
 */
export const wsExpect: ActionDefinition = defineAction({
  name: "expect",
  doc: "Wait for the next matching incoming message.",
  params,
  result: t.ref("ws.Message"),
  run: (ctx, input) => ctx.port(WsClientPort).expect(input.params),
});

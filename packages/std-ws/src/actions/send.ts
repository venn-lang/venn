import { type ActionDefinition, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { WsClientPort } from "../port/index.js";

const params = z.object({ type: z.string().optional(), data: z.unknown().optional() });

/**
 * `ws.send { type: "ping", data: 1 }`: write one message.
 *
 * Nothing is positional: the options map is the message, and `params` above is
 * what checks its keys.
 */
export const wsSend: ActionDefinition = defineAction({
  name: "send",
  doc: "Send a message over the WebSocket.",
  params,
  result: t.void,
  run: (ctx, input) => ctx.port(WsClientPort).send(input.params),
});

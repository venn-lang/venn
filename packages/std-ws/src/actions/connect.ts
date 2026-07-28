import { type ActionDefinition, arg, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { WsClientPort } from "../port/index.js";

const params = z.object({ auth: z.unknown().optional() });

/**
 * `ws.connect "wss://…" { auth: token }`: open the socket.
 *
 * Returns nothing, because the port owns the connection. That is what lets
 * `ws.send` and `ws.close` reach it without the flow carrying a handle.
 */
export const wsConnect: ActionDefinition = defineAction({
  name: "connect",
  doc: "Open a WebSocket connection.",
  params,
  args: [arg("url", t.string, "Where to connect: `ws://` or `wss://`.")],
  result: t.void,
  run: (ctx, input) =>
    ctx.port(WsClientPort).connect({ url: String(input.args[0] ?? ""), auth: input.params.auth }),
});

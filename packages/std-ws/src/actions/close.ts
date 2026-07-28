import { type ActionDefinition, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import { WsClientPort } from "../port/index.js";

/** `ws.close`: hang up the connection the port is holding. Takes nothing. */
export const wsClose: ActionDefinition = defineAction({
  name: "close",
  doc: "Close the WebSocket connection.",
  result: t.void,
  run: (ctx) => ctx.port(WsClientPort).close(),
});

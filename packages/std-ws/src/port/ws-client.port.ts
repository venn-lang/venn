import type { Port } from "@venn/contracts";
import type { WsClient } from "./ws-client.types.js";

/**
 * The port descriptor every `ws` verb resolves through `ctx.port(...)`.
 *
 * Declares the `net` capability, so a host that cannot open sockets refuses the
 * binding at load time with a readable diagnostic.
 */
export const WsClientPort: Port<WsClient> = {
  id: "venn.port.ws-client",
  version: 1,
  requires: ["net"],
  methods: ["connect", "send", "expect", "close"],
};

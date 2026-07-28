import type { Port } from "@venn-lang/contracts";
import type { HttpClient } from "./http-client.types.js";

/**
 * The port descriptor an http verb resolves through `ctx.port(...)`.
 *
 * Declares the `net` capability, so a host that cannot open sockets refuses the
 * binding at load time with a readable diagnostic.
 */
export const HttpClientPort: Port<HttpClient> = {
  id: "venn.port.http-client",
  version: 1,
  requires: ["net"],
  methods: ["request"],
};

import type { Port } from "@venn/contracts";
import type { HttpServer } from "./http-server.types.js";

/**
 * The port descriptor `http.serve` resolves through `ctx.port(...)`.
 *
 * Declares the `net` capability, so a host that cannot bind a socket refuses the
 * binding at load time rather than mid-flow.
 */
export const HttpServerPort: Port<HttpServer> = {
  id: "venn.port.http-server",
  version: 1,
  requires: ["net"],
  methods: ["listen"],
};

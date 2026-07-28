import type { Port } from "@venn/contracts";
import type { GqlClient } from "./gql-client.types.js";

/**
 * The port descriptor every `gql` verb resolves through `ctx.port(...)`.
 *
 * Declares the `net` capability, so a host that cannot reach an endpoint refuses
 * the binding at load time with a readable diagnostic.
 */
export const GqlClientPort: Port<GqlClient> = {
  id: "venn.port.gql-client",
  version: 1,
  requires: ["net"],
  methods: ["execute", "subscribe"],
};

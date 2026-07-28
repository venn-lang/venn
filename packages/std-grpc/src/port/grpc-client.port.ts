import type { Port } from "@venn-lang/contracts";
import type { GrpcClient } from "./grpc-client.types.js";

/**
 * The port descriptor every `grpc` verb resolves through `ctx.port(...)`.
 *
 * Declares the `net` capability, so a host that cannot open a channel refuses
 * the binding at load time with a readable diagnostic.
 */
export const GrpcClientPort: Port<GrpcClient> = {
  id: "venn.port.grpc-client",
  version: 1,
  requires: ["net"],
  methods: ["call", "stream", "reflect"],
};

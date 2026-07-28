import { VennError } from "@venn-lang/contracts";
import type { GqlClient } from "../port/index.js";

/**
 * The real GraphQL client. Not implemented in this build.
 *
 * It exists so the port has its second implementation and the failure is a named
 * Venn error rather than a missing method.
 *
 * @throws VN8090 from every method.
 */
export function createRealClient(): GqlClient {
  return {
    async execute() {
      return unimplemented();
    },
    async subscribe() {
      return unimplemented();
    },
  };
}

function unimplemented(): never {
  throw new VennError({
    code: "VN8090",
    message: "GraphQL real client not implemented in this build",
  });
}

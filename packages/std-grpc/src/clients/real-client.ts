import { VennError } from "@venn/contracts";
import type { GrpcClient } from "../port/index.js";

/**
 * The real gRPC client. Not implemented in this build: proto loading, channels
 * and reflection are out of scope here.
 *
 * It exists so the port has its second implementation and the failure is a named
 * Venn error rather than a missing method.
 *
 * @throws VN8090 from every method.
 */
export function createRealClient(): GrpcClient {
  return {
    async call() {
      return unimplemented();
    },
    async stream() {
      return unimplemented();
    },
    async reflect() {
      return unimplemented();
    },
  };
}

function unimplemented(): never {
  throw new VennError({
    code: "VN8090",
    message: "gRPC real client not implemented in this build",
  });
}

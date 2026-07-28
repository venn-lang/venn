import { VennError } from "@venn/contracts";
import type { DbClient } from "../port/index.js";

/**
 * The driver-backed `DbClient`. Not implemented in this build.
 *
 * @throws VennError `VN8090` from every method, so a host that binds it fails
 * loudly instead of quietly answering with nothing.
 */
export function createRealDbClient(): DbClient {
  return {
    connect: () => notImplemented(),
    query: () => notImplemented(),
    exec: () => notImplemented(),
    seed: () => notImplemented(),
    snapshot: () => notImplemented(),
    restore: () => notImplemented(),
  };
}

function notImplemented(): never {
  throw new VennError({
    code: "VN8090",
    message: "Db real client not implemented in this build",
  });
}

import { VennError } from "@venn/contracts";
import type { ArtifactStore } from "./artifact-store.types.js";

/**
 * The disk-backed `ArtifactStore`. Not wired up in this build.
 *
 * @returns a store whose every method throws, so the gap is a legible failure
 * rather than a silent no-op.
 * @throws {VennError} `VN8090` on any call.
 */
export function createRealArtifactStore(): ArtifactStore {
  return {
    put: async () => notImplemented(),
    get: async () => notImplemented(),
    list: async () => notImplemented(),
    flush: async () => notImplemented(),
  };
}

function notImplemented(): never {
  throw new VennError({
    code: "VN8090",
    message: "The artifact store is not implemented in this build.",
  });
}

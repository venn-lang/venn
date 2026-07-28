import type { ArtifactRef } from "../types/index.js";
import type { ArtifactStore } from "./artifact-store.types.js";

/**
 * The in-memory `ArtifactStore` used by tests and by hosts without a disk.
 *
 * @returns a fresh store; nothing is shared between calls.
 */
export function createMemoryArtifactStore(): ArtifactStore {
  const stored = new Map<string, ArtifactRef>();
  let pending: ArtifactRef[] = [];
  return {
    async put(ref) {
      stored.set(ref.name, ref);
      pending.push(ref);
      return ref;
    },
    async get(name) {
      return stored.get(name);
    },
    async list() {
      return [...stored.values()];
    },
    async flush() {
      const drained = pending;
      pending = [];
      return drained;
    },
  };
}

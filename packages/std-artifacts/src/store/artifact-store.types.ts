import type { ArtifactRef } from "../types/index.js";

/**
 * Keeps references to what a run produced.
 *
 * `put`, `get` and `list` address the stored set. `flush` drains the pending
 * buffer accumulated since the last flush, leaving the stored set untouched.
 */
export interface ArtifactStore {
  /** Stores a ref and queues it for the next flush. Returns the ref as stored. */
  put(ref: ArtifactRef): Promise<ArtifactRef>;
  get(name: string): Promise<ArtifactRef | undefined>;
  list(): Promise<readonly ArtifactRef[]>;
  flush(): Promise<readonly ArtifactRef[]>;
}

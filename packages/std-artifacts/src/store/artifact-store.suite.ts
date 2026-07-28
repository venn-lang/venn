import { describe, expect, it } from "vitest";
import type { ArtifactStore } from "./artifact-store.types.js";

/** One `ArtifactStore` implementation to put through the suite. */
export interface ArtifactStoreSpec {
  name: string;
  /** Builds a store with no state carried over from a previous case. */
  make(): ArtifactStore;
}

/**
 * The `ArtifactStore` conformance suite. Every implementation runs it: `put`
 * records, `get` and `list` return what was recorded, and `flush` drains the
 * pending buffer without discarding the stored set.
 */
export function artifactStoreConformance(spec: ArtifactStoreSpec): void {
  describe(`ArtifactStore · ${spec.name}`, () => {
    it("put records a ref that list and get return", async () => {
      const store = spec.make();
      await store.put({ name: "trace", kind: "trace" });
      expect(await store.list()).toHaveLength(1);
      expect(await store.get("trace")).toMatchObject({ name: "trace", kind: "trace" });
    });

    it("flush drains the pending buffer but keeps stored refs", async () => {
      const store = spec.make();
      await store.put({ name: "video", kind: "video" });
      expect(await store.flush()).toHaveLength(1);
      expect(await store.flush()).toHaveLength(0);
      expect(await store.list()).toHaveLength(1);
    });
  });
}

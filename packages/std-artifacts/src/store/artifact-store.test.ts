import { assertPortShape, VennError } from "@venn-lang/contracts";
import { expect, it } from "vitest";
import { ArtifactStorePort } from "./artifact-store.port.js";
import { artifactStoreConformance } from "./artifact-store.suite.js";
import { createMemoryArtifactStore } from "./memory-store.js";
import { createRealArtifactStore } from "./real-store.js";

artifactStoreConformance({ name: "memory", make: () => createMemoryArtifactStore() });

it("the real store rejects — not implemented in this build (VN8090)", async () => {
  const make = () => createRealArtifactStore().list();
  await expect(make()).rejects.toBeInstanceOf(VennError);
  await expect(make()).rejects.toMatchObject({ code: "VN8090" });
});

// `artifacts.flush` calls `flush`, so the port has to require it: a method the
// descriptor leaves out is a method nobody checks at load time.
it("rejects a store missing a method the flush verb calls (VN2011)", () => {
  const { flush, ...withoutFlush } = createMemoryArtifactStore();
  expect(() => assertPortShape({ port: ArtifactStorePort, impl: withoutFlush })).toThrowError(
    expect.objectContaining({ code: "VN2011" }),
  );
});

import { describe, expect, it } from "vitest";
import type { ConformanceSpec } from "../../conformance/index.js";
import type { ManifestProvider } from "./manifest.types.js";

/**
 * The {@link ManifestProvider} TCK. Whatever the source, `load()` returns a
 * manifest with a name and an env map, never a partial one.
 */
export function manifestProviderConformance(
  spec: ConformanceSpec<ManifestProvider> & { expectedName: string },
): void {
  describe(`ManifestProvider · ${spec.name}`, () => {
    it("loads a manifest with a name and env map", async () => {
      const manifest = (await spec.factory()).load();
      expect(manifest.name).toBe(spec.expectedName);
      expect(typeof manifest.env).toBe("object");
    });
  });
}

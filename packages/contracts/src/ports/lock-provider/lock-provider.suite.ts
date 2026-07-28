import { describe, expect, it } from "vitest";
import type { ConformanceSpec } from "../../conformance/index.js";
import type { LockProvider } from "./lock-provider.types.js";

/**
 * The {@link LockProvider} TCK. Acquiring, releasing and acquiring again must
 * not deadlock, which is the one law the fake and the real mutex share.
 */
export function lockProviderConformance(spec: ConformanceSpec<LockProvider>): void {
  describe(`LockProvider · ${spec.name}`, () => {
    it("acquire returns a release, and re-acquiring after release works", async () => {
      const lock = await spec.factory();
      const release = await lock.acquire("k");
      release();
      const again = await lock.acquire("k");
      again();
      expect(typeof again).toBe("function");
    });
  });
}

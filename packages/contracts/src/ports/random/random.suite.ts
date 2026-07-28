import { describe, expect, it } from "vitest";
import type { ConformanceSpec } from "../../conformance/index.js";
import type { Random } from "./random.types.js";

/** The {@link Random} TCK: the range laws both seeded and fixed satisfy. */
export function randomConformance(spec: ConformanceSpec<Random>): void {
  describe(`Random · ${spec.name}`, () => {
    it("next() stays within [0, 1)", async () => {
      const random = await spec.factory();
      for (let i = 0; i < 100; i++) {
        const value = random.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it("int(min, max) stays within the inclusive range", async () => {
      const random = await spec.factory();
      for (let i = 0; i < 100; i++) {
        const value = random.int(3, 7);
        expect(value).toBeGreaterThanOrEqual(3);
        expect(value).toBeLessThanOrEqual(7);
      }
    });
  });
}

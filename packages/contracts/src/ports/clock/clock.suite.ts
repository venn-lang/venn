import { describe, expect, it } from "vitest";
import type { ConformanceSpec } from "../../conformance/index.js";
import type { Clock } from "./clock.types.js";

/** The {@link Clock} TCK. Both the system and virtual clocks satisfy it. */
export function clockConformance(spec: ConformanceSpec<Clock>): void {
  describe(`Clock · ${spec.name}`, () => {
    it("now() is non-decreasing", async () => {
      const clock = await spec.factory();
      const first = clock.now();
      expect(clock.now()).toBeGreaterThanOrEqual(first);
    });

    it("sleep advances now() by about the requested delay", async () => {
      const clock = await spec.factory();
      const before = clock.now();
      await clock.sleep(20);
      // A real timer may fire a millisecond or two early, so the bound is loose.
      // What must never happen is returning wildly short.
      expect(clock.now()).toBeGreaterThanOrEqual(before + 18);
    });
  });
}

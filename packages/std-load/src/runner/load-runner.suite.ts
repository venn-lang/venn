import { describe, expect, it } from "vitest";
import { constantProfile } from "../profiles/index.js";
import type { LoadRunner } from "./load-runner.types.js";

/** One `LoadRunner` implementation to put through the suite. */
export interface LoadRunnerSpec {
  name: string;
  /** Builds a runner with no state carried over from a previous case. */
  make(): LoadRunner;
}

/**
 * The `LoadRunner` conformance suite. Every implementation runs it: percentiles
 * come back ordered and `vus` reports the profile's peak concurrency.
 */
export function loadRunnerConformance(spec: LoadRunnerSpec): void {
  describe(`LoadRunner · ${spec.name}`, () => {
    it("run yields metrics with p50 <= p95 <= p99", async () => {
      const metrics = await spec.make().run(constantProfile({ vus: 50, over: 1000 }));
      expect(metrics.p50).toBeLessThanOrEqual(metrics.p95);
      expect(metrics.p95).toBeLessThanOrEqual(metrics.p99);
    });

    it("run reports the profile's peak VUs", async () => {
      const metrics = await spec.make().run(constantProfile({ vus: 50, over: 1000 }));
      expect(metrics.vus).toBe(50);
    });
  });
}

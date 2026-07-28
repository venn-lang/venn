import type { LoadMetrics } from "../metrics/index.js";
import { type LoadProfile, peakVus } from "../profiles/index.js";
import type { LoadRunner } from "./load-runner.types.js";

/**
 * The offline `LoadRunner`. Derives plausible metrics from the profile's peak
 * concurrency and sends no traffic.
 *
 * @returns a runner whose results are deterministic for a given profile.
 */
export function createFakeLoadRunner(): LoadRunner {
  return {
    run: async (profile) => metricsFor(profile),
  };
}

function metricsFor(profile: LoadProfile): LoadMetrics {
  const vus = peakVus(profile);
  return { vus, rps: vus * 10, p50: 50, p95: 120, p99: 200, errorRate: 0.01 };
}

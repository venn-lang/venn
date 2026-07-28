import type { LoadMetrics } from "../metrics/index.js";
import type { LoadProfile } from "../profiles/index.js";

/** What turns a profile into traffic. */
export interface LoadRunner {
  /**
   * Executes one profile to completion.
   *
   * @returns the metrics observed, with `p50 <= p95 <= p99`.
   * @throws {VennError} `VN8090` from an implementation that cannot run.
   */
  run(profile: LoadProfile): Promise<LoadMetrics>;
}

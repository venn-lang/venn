/**
 * What a load run reports back. Latencies are in milliseconds and the ordering
 * `p50 <= p95 <= p99` always holds; the conformance suite enforces it.
 */
export interface LoadMetrics {
  /** Peak concurrent virtual users the run reached. */
  vus: number;
  /** Requests per second, averaged over the run. */
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  /** Share of failed requests, from 0 to 1. */
  errorRate: number;
}

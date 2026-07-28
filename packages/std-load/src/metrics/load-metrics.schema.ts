import { type ZodType, z } from "@venn-lang/sdk";
import type { LoadMetrics } from "./load-metrics.types.js";

/** Runtime validator for the nominal `load.Metrics` type. */
export const LoadMetricsSchema: ZodType<LoadMetrics> = z.object({
  vus: z.number(),
  rps: z.number(),
  p50: z.number(),
  p95: z.number(),
  p99: z.number(),
  errorRate: z.number(),
});

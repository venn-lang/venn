import type { Timing } from "../bench.types.ts";

/** Summarise timing samples. The median is the headline: it ignores a stray GC pause. */
export function summarise(samples: readonly number[]): Timing {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    median: median(sorted),
    min: sorted[0] ?? 0,
    mean: sorted.reduce((total, one) => total + one, 0) / (sorted.length || 1),
    samples: sorted.length,
  };
}

function median(sorted: readonly number[]): number {
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

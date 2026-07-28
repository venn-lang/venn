import { type Console, createMemoryConsole } from "@venn/contracts";

/** A console that records, plus a way to read only what the last run wrote. */
export interface Capture {
  console: Console;
  take(): string;
}

/**
 * The console is bound once, when the runner is built, but each run needs its
 * own output. Reading the transcript's tail gives that without rebuilding the
 * runner — which would put registry setup inside the measurement.
 */
export function capture(): Capture {
  const memory = createMemoryConsole();
  let seen = 0;
  return {
    console: memory,
    take: () => {
      const written = memory.out.slice(seen);
      seen = memory.out.length;
      return written.trim();
    },
  };
}

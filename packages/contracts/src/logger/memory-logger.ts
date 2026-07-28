import type { LogEntry, MemoryLogger } from "./logger.types.js";

/** The double: keeps every entry in `entries` instead of printing it. */
export function createMemoryLogger(): MemoryLogger {
  const entries: LogEntry[] = [];
  return {
    entries,
    log(entry) {
      entries.push(entry);
    },
  };
}

import type { Logger } from "./logger.types.js";

/** Logger backed by the global console, so it works in a Worker and in Node. */
export function createConsoleLogger(): Logger {
  return {
    log(entry) {
      const line = `[${entry.level}] ${entry.message}`;
      if (entry.level === "error") console.error(line);
      else console.log(line);
    },
  };
}

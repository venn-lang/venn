import { closeAll } from "../cleanup/index.js";
import type { Cleanup, CleanupList } from "./cleanup.types.js";

/**
 * The runtime's own sink, for a host that does not bring one.
 *
 * Closing runs newest first and survives a cleanup that throws: a program on its
 * way out still has to hand back everything else it was holding.
 */
export function createCleanupList(): CleanupList {
  const pending: Cleanup[] = [];
  return {
    add: (cleanup) => pending.push(cleanup),
    close: () => closeAll(pending.splice(0).reverse()),
  };
}

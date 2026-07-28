import type { Clock, Random } from "@venn/contracts";
import type { RunId } from "@venn/core";

/**
 * Mint a run id from the host clock and random source, so a seeded run is
 * reproducible. Real ULID minting comes later.
 */
export function newRunId(args: { clock: Clock; random: Random }): RunId {
  const rand = Math.floor(args.random.next() * 1e9).toString(36);
  return `run-${args.clock.now().toString(36)}-${rand}` as RunId;
}

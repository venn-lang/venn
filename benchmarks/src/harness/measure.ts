import type { Timing } from "../bench.types.ts";
import { summarise } from "./stats.ts";

export interface MeasureArgs {
  run: () => unknown | Promise<unknown>;
  reps: number;
  warmup: number;
  /**
   * How many times to go round the whole thing, warmup included.
   *
   * One round is enough to see a case, and not enough to compare two: the
   * median across eight cases moved between 51% and 68% of V8 from run to run,
   * because a single case drifting past its neighbour changes which one sits in
   * the middle. More rounds, with every sample kept, is what makes a headline
   * number worth printing.
   */
  rounds?: number;
}

/**
 * Where every measured result goes, so that none of them is dead.
 *
 * A thunk whose value nobody reads is a thunk an optimiser may delete. JSC does
 * exactly that: under Bun the TypeScript twins first measured five to ten times
 * faster than under Node, which is not an engine being better — it is a loop
 * that never ran. Keeping the last value in a binding the module exports puts
 * it beyond the optimiser's reach.
 */
export let sink: unknown;

/**
 * Time a thunk. Warmup matters more here than in most harnesses: one side is
 * JIT-compiled and reaches its real speed only after a few passes, so timing a
 * cold run would flatter the interpreter.
 */
export async function measure(args: MeasureArgs): Promise<Timing> {
  const samples: number[] = [];
  for (let round = 0; round < (args.rounds ?? 1); round += 1) {
    for (let i = 0; i < args.warmup; i += 1) sink = await args.run();
    for (let i = 0; i < args.reps; i += 1) samples.push(await once(args.run));
  }
  return summarise(samples);
}

async function once(run: MeasureArgs["run"]): Promise<number> {
  const started = process.hrtime.bigint();
  sink = await run();
  return Number(process.hrtime.bigint() - started) / 1e6;
}

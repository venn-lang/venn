import type { Timing } from "../bench.types.ts";
import { summarise } from "./stats.ts";

export interface MeasureArgs {
  run: () => unknown | Promise<unknown>;
  reps: number;
  warmup: number;
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
  for (let i = 0; i < args.warmup; i += 1) sink = await args.run();
  const samples: number[] = [];
  for (let i = 0; i < args.reps; i += 1) samples.push(await once(args.run));
  return summarise(samples);
}

async function once(run: MeasureArgs["run"]): Promise<number> {
  const started = process.hrtime.bigint();
  sink = await run();
  return Number(process.hrtime.bigint() - started) / 1e6;
}

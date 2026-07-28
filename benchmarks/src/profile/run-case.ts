import { resolve } from "node:path";
import { loadProgram } from "../program/index.ts";

/**
 * Run one case in a loop, for `node --cpu-prof` to sample. Kept separate from
 * the harness: a profile wants many uninterrupted runs, not timed ones.
 */
const file = process.argv[2] ?? "fib.vn";
const program = await loadProgram(resolve(import.meta.dirname, "../../cases", file));
// Enough passes that process startup does not drown the signal: the cases got
// fast enough that 12 runs were mostly module loading.
for (let i = 0; i < 120; i += 1) await program.execute();

import { spawn } from "node:child_process";
import { basename, extname, resolve } from "node:path";
import type { StartupResult, Timing } from "../bench.types.ts";
import { measure } from "../harness/index.ts";
import { findPython } from "../python/index.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const VENN = resolve(ROOT, "packages/cli/dist/bin/venn.mjs");
const CASES = resolve(ROOT, "benchmarks/cases");

/**
 * The wall clock of a whole process, which is what a person actually waits for.
 * Both run the same `fib(25)`: one as TypeScript that Node strips types from,
 * one as a `.vn` file through the CLI.
 */
export async function measureStartup(): Promise<StartupResult> {
  const reps = { reps: 5, warmup: 1 };
  return {
    // Whatever is running this harness runs both sides, so the comparison holds
    // under `bun src/main.ts` as well as under `node`.
    runtime: basename(process.execPath, extname(process.execPath)),
    script: await measure({ ...reps, run: () => exec([resolve(CASES, "fib.ts")]) }),
    venn: await measure({ ...reps, run: () => exec([VENN, "run", resolve(CASES, "fib.vn")]) }),
    python: await pythonStart(reps),
  };
}

async function pythonStart(reps: { reps: number; warmup: number }): Promise<Timing | undefined> {
  const python = findPython();
  if (!python) return undefined;
  return measure({ ...reps, run: () => spawn_(python, [resolve(CASES, "fib.py")]) });
}

function exec(args: readonly string[]): Promise<void> {
  return spawn_(process.execPath, args);
}

function spawn_(command: string, args: readonly string[]): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(command, [...args], { stdio: "ignore" });
    child.on("error", fail);
    child.on("exit", (code) => (code === 0 ? done() : fail(new Error(`exit ${code}`))));
  });
}

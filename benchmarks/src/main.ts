import { resolve } from "node:path";
import { parse } from "@venn-lang/core";
import type { BenchCase, CaseResult } from "./bench.types.ts";
import { CASES } from "./cases/index.ts";
import { measure, sink } from "./harness/index.ts";
import { loadProgram } from "./program/index.ts";
import { measurePython } from "./python/index.ts";
import { report } from "./report/index.ts";
import { measureStartup } from "./startup/index.ts";

const CASE_DIR = resolve(import.meta.dirname, "../cases");

/**
 * How many times each case is measured end to end. `--rounds 3` for a number
 * worth writing down; one is enough while working on a case.
 */
const ROUNDS = rounds();

function rounds(): number {
  const at = process.argv.indexOf("--rounds");
  const asked = at === -1 ? Number.NaN : Number(process.argv[at + 1]);
  return Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : 1;
}

/** A value no case can produce, so the comparison below never fires. */
const UNREACHABLE = Symbol("unreachable");

async function main(): Promise<void> {
  warmParser();
  process.stderr.write("  measuring python…\n");
  const python = measurePython();
  const results: CaseResult[] = [];
  for (const bench of CASES) {
    process.stderr.write(`  measuring ${bench.name}…\n`);
    results.push({ ...(await runCase(bench)), python: python?.[bench.name] });
  }
  process.stderr.write("  measuring cold start…\n\n");
  process.stdout.write(`${report(results, await measureStartup())}\n`);
  // Read what every measured call produced, so an optimiser cannot decide the
  // calls were pointless and delete them. JavaScriptCore does exactly that.
  if (sink === UNREACHABLE) process.stderr.write("unreachable\n");
}

/**
 * Langium builds its lexer and parser on first use, some 60 ms, paid once per
 * process. Measured as part of the first case it would read as that case's
 * compile time, which it is not.
 */
function warmParser(): void {
  parse("print 1\n", { uri: "memory://warmup.vn" });
}

async function runCase(bench: BenchCase): Promise<CaseResult> {
  const program = await loadProgram(resolve(CASE_DIR, bench.vn));
  const timing = { reps: bench.reps, warmup: bench.warmup, rounds: ROUNDS };
  const vn = await measure({ ...timing, run: program.execute });
  const ts = await measure({ ...timing, run: bench.ts });
  return {
    name: bench.name,
    stresses: bench.stresses,
    ts,
    vn,
    compile: program.compileMs,
    agrees: (await program.execute()) === String(bench.ts()),
  };
}

await main();

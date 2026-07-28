import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { findPython } from "./find-python.ts";

const CASES = resolve(import.meta.dirname, "../../cases");

/**
 * The same workloads, timed by Python itself.
 *
 * Python does its own warmup, repetitions and median inside `runner.py` — the
 * numbers come back already summarised, because timing an interpreter from
 * outside its process would measure the process instead.
 */
export function measurePython(): Record<string, number> | undefined {
  const python = findPython();
  if (!python) return undefined;
  const run = spawnSync(python, [resolve(CASES, "runner.py")], {
    cwd: CASES,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (run.status !== 0) return undefined;
  return parse(run.stdout);
}

function parse(out: string): Record<string, number> | undefined {
  try {
    return JSON.parse(out.trim()) as Record<string, number>;
  } catch {
    return undefined;
  }
}

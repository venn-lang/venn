import type { CaseResult, StartupResult } from "../bench.types.ts";
import { ms, share, times } from "./format.ts";
import { table } from "./table.ts";

const HEAD = ["case", "TS (ms)", "Venn (ms)", "Python (ms)", "TS is", "vs Python", "compile (ms)"];

/** The whole write-up: per case, then the overall picture, then startup. */
export function report(results: readonly CaseResult[], startup: StartupResult): string {
  return [
    table([HEAD, ...results.map(row)]),
    "",
    ...disagreements(results),
    overall(results),
    "",
    startupLines(startup),
  ].join("\n");
}

function row(result: CaseResult): string[] {
  const ratio = result.vn.median / result.ts.median;
  return [
    result.name + (result.agrees ? "" : " ✗"),
    ms(result.ts.median),
    ms(result.vn.median),
    result.python === undefined ? "—" : ms(result.python),
    times(ratio),
    versus(result),
    ms(result.compile),
  ];
}

/** How Venn reads against Python: under 1× means Venn got there first. */
function versus(result: CaseResult): string {
  if (result.python === undefined) return "—";
  return times(result.vn.median / result.python);
}

function disagreements(results: readonly CaseResult[]): string[] {
  const wrong = results.filter((result) => !result.agrees).map((result) => result.name);
  if (wrong.length === 0) return [];
  return [`✗ answers differ, so these rows mean nothing: ${wrong.join(", ")}`, ""];
}

function overall(results: readonly CaseResult[]): string {
  const ratios = results.map((result) => result.vn.median / result.ts.median);
  const won = results.filter((result) => result.vn.median < result.ts.median);
  return [
    `Spread: ${times(Math.min(...ratios))} to ${times(Math.max(...ratios))}.${wins(won)}`,
    `Against V8:     ${mean(ratios)} of its speed.`,
    againstPython(results),
  ]
    .filter(Boolean)
    .join("\n");
}

/** The comparison that says most about an interpreter: another interpreter. */
function againstPython(results: readonly CaseResult[]): string {
  const paired = results.filter((result) => result.python !== undefined);
  if (paired.length === 0) return "";
  const ratios = paired.map((result) => result.vn.median / (result.python as number));
  const ahead = paired.filter((result) => result.vn.median < (result.python as number));
  const names = ahead.map((result) => result.name).join(", ");
  return `Against Python: ${mean(ratios)} of its speed.${names ? ` Venn is ahead in: ${names}.` : ""}`;
}

function mean(ratios: readonly number[]): string {
  return `geometric mean ${times(geomean(ratios))} — Venn runs at ${share(geomean(ratios))}`;
}

/** Naming the cases Venn won, rather than assuming it never does. */
function wins(won: readonly CaseResult[]): string {
  if (won.length === 0) return " TypeScript wins every case.";
  return ` Venn is ahead in: ${won.map((result) => result.name).join(", ")}.`;
}

/** The geometric mean is the honest average of ratios; the arithmetic one is not. */
function geomean(values: readonly number[]): number {
  const sum = values.reduce((total, value) => total + Math.log(value), 0);
  return Math.exp(sum / (values.length || 1));
}

function startupLines(startup: StartupResult): string {
  const ratio = startup.venn.median / startup.script.median;
  const run = startup.runtime;
  return [
    `Cold start — one process, end to end, running the same fib(25) under ${run}:`,
    `  ${run} fib.ts       ${ms(startup.script.median)} ms`,
    `  venn run fib.vn ${ms(startup.venn.median)} ms   (${times(ratio)} of that)`,
    startup.python ? `  python fib.py      ${ms(startup.python.median)} ms` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

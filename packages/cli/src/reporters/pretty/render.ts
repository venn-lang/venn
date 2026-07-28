import { relative } from "node:path";
import type { Problem } from "@venn-lang/core";
import { bold, cyan, dim, green, inverse, red } from "../colors.js";
import { diffLines } from "./diff-lines.js";
import type { Failure } from "./pretty.types.js";

const PASS = "✓";
const FAIL = "✗";

/** The banner naming the file under test. Flows add their own leading blank line. */
export function header(file: string): string {
  return `\n${inverse(cyan(" RUN "))} ${dim(shorten(file))}`;
}

/** A flow opens a branch of the tree. */
export function flowLine(title: string): string {
  return `\n ${dim("❯")} ${bold(title)}`;
}

/** A step closes with its verdict and how long it took. */
export function stepLine(args: { title: string; passed: boolean; ms: number }): string {
  const mark = args.passed ? green(PASS) : red(FAIL);
  return `   ${mark} ${args.title} ${dim(`${args.ms}ms`)}`;
}

/** Why a step failed, shown inline right under it. */
export function reasonLine(failure: Failure): string {
  return `     ${red("→")} ${failure.title}`;
}

/** A `log` line the flow emitted, shown under its step like console output. */
export function logLine(message: string): string {
  const [first = "", ...rest] = message.split("\n");
  const head = `     ${dim("›")} ${first}`;
  return [head, ...rest.map((line) => `       ${line}`)].join("\n");
}

export function failuresBlock(failures: readonly Failure[]): string {
  if (failures.length === 0) return "";
  const blocks = failures.map((failure, index) => block(failure, index + 1));
  return `\n${inverse(red(" FAILURES "))}\n\n${blocks.join("\n\n")}\n`;
}

export function summary(args: {
  passed: number;
  failed: number;
  files?: number;
  ms: number;
}): string {
  const counts = [
    args.failed > 0 ? red(`${args.failed} failed`) : undefined,
    green(`${args.passed} passed`),
  ];
  const line = counts.filter(Boolean).join(dim(" | "));
  const total = dim(`(${args.passed + args.failed})`);
  const files = args.files && args.files > 1 ? `\n ${dim("Files")}  ${args.files}` : "";
  return `${files}\n ${dim("Tests")}  ${line} ${total}\n ${dim(" Time")}  ${dim(`${args.ms}ms`)}\n`;
}

/** `examples/testing/01-first-flow.vn:12:5`, relative to where the CLI was invoked. */
export function locationOf(problem: Problem): string | undefined {
  const span = problem.span;
  if (!span?.uri) return undefined;
  return `${shorten(span.uri)}:${span.line}:${span.column}`;
}

function block(failure: Failure, index: number): string {
  const lines = [
    `  ${red(`${index})`)} ${bold(where(failure))}`,
    `     ${red(failure.code)}  ${failure.title}`,
  ];
  if (failure.location) lines.push(`     ${dim(`at ${failure.location}`)}`);
  if (failure.diff) lines.push("", ...diffLines(failure.diff));
  return lines.join("\n");
}

/**
 * Which flow and step it happened in. A hook that failed belongs to neither, so
 * it says so instead of borrowing the last step's name.
 */
function where(failure: Failure): string {
  return [failure.flow, failure.step].filter(Boolean).join(` ${dim("›")} `) || "lifecycle";
}

function shorten(file: string): string {
  const path = relative(process.cwd(), file);
  return path && !path.startsWith("..") ? path.replace(/\\/g, "/") : file;
}

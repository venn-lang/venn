import type { Problem, Status } from "@venn-lang/core";
import { shorten } from "../../paths/index.js";
import { bold, cyan, dim, green, inverse, red, yellow } from "../colors.js";
import { problemDetail } from "../problem-detail.js";
import { diffLines } from "./diff-lines.js";
import type { Failure } from "./pretty.types.js";

const PASS = "✓";
const FAIL = "✗";
/** Neither verdict: a `break`, `return` or `exit` cut the step short. */
const CUT = "-";

/** Where a step's verdict starts, one branch in from its flow. */
const BESIDE_STEPS = "   ";
/** Where a step's own lines start, one branch in from its verdict. */
const UNDER_STEP = "     ";

/** The banner naming the file under test. Flows add their own leading blank line. */
export function header(file: string): string {
  return `\n${inverse(cyan(" RUN "))} ${dim(shorten(file))}`;
}

/** A flow opens a branch of the tree. */
export function flowLine(title: string): string {
  return `\n ${dim("❯")} ${bold(title)}`;
}

/**
 * A step closes with its verdict and how long it took. One that was cut short
 * reached no verdict, so it gets neither a tick nor a cross.
 */
export function stepLine(args: { title: string; status: Status; ms: number }): string {
  const mark = verdict(args.status);
  return `${BESIDE_STEPS}${mark} ${args.title} ${dim(`${args.ms}ms`)}`;
}

function verdict(status: Status): string {
  if (status === "passed") return green(PASS);
  if (status === "cancelled") return dim(CUT);
  return red(FAIL);
}

/**
 * Why a step failed, shown inline right under it. A soft one says so: the step
 * asked to record it and carry on, and it did.
 */
export function reasonLine(failure: Failure): string {
  const arrow = failure.soft ? yellow("→") : red("→");
  const kept = failure.soft ? ` ${dim("(recorded, the step carried on)")}` : "";
  return `${UNDER_STEP}${arrow} ${failure.title}${kept}`;
}

/**
 * A `log` line the flow emitted, shown like console output in vitest.
 *
 * @param args.message What the program said, however many lines it runs to.
 * @param args.inStep Whether a step said it. One written between two steps
 * belongs to neither, so it sits where the steps sit: printed under one, it read
 * as that step's own output.
 * @returns The line, and an indented continuation for every line after the first.
 */
export function logLine(args: { message: string; inStep: boolean }): string {
  const indent = args.inStep ? UNDER_STEP : BESIDE_STEPS;
  const [first = "", ...rest] = args.message.split("\n");
  const head = `${indent}${dim("›")} ${first}`;
  return [head, ...rest.map((line) => `${indent}  ${line}`)].join("\n");
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
  // What the problem knows besides where it happened: the help a check worked
  // out, the note explaining the rule, the places worth looking at.
  if (failure.problem) {
    lines.push(...problemDetail(failure.problem, { indent: "     ", where: false }));
  }
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

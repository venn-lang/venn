import type { Envelope, Problem } from "@venn/core";
import type { Reporter, RunTotals } from "../reporter.types.js";
import type { Failure, PrettyState } from "./pretty.types.js";
import {
  failuresBlock,
  flowLine,
  header,
  locationOf,
  logLine,
  reasonLine,
  stepLine,
  summary,
} from "./render.js";

/**
 * A live tree: each file opens a banner, each flow a branch, and each step
 * prints its verdict as soon as it settles. Everything that failed across every
 * file is repeated at the end with its code and source location.
 */
export function createPrettyReporter(): Reporter {
  const state: PrettyState = {
    flow: "",
    step: "",
    inStep: false,
    stepStartedAt: 0,
    current: [],
    logs: [],
    failures: [],
  };
  return {
    sink: { emit: (envelope) => handle(envelope, state) },
    beginFile: (file) => {
      state.pendingFile = file;
    },
    finish: (totals) => finishRun(state, totals),
  };
}

function handle(envelope: Envelope, state: PrettyState): void {
  const data = envelope.data as Record<string, unknown>;
  if (envelope.kind === "flow.started") beginFlow(state, data);
  else if (envelope.kind === "step.started") beginStep(state, envelope, data);
  else if (envelope.kind === "expect.failed") failed(state, data);
  else if (envelope.kind === "step.finished") endStep(state, envelope, data);
  else if (envelope.kind === "flow.finished") state.flow = "";
  else if (envelope.kind === "log") logged(state, data);
}

/**
 * A failure inside a step waits for that step's verdict, to print under it. One
 * that arrives between steps (a `setup` or a `teardown` that blew up) has no
 * verdict coming, and holding it would let the next `step.started` wipe it, so
 * it goes straight to the summary.
 */
function failed(state: PrettyState, data: Record<string, unknown>): void {
  const failure = fromProblem(state, data);
  if (state.inStep) state.current.push(failure);
  else state.failures.push(failure);
}

function beginFlow(state: PrettyState, data: Record<string, unknown>): void {
  if (state.pendingFile) {
    write(header(state.pendingFile));
    state.pendingFile = undefined;
  }
  state.flow = String(data.title ?? "");
  write(flowLine(state.flow));
}

function beginStep(state: PrettyState, envelope: Envelope, data: Record<string, unknown>): void {
  state.step = String(data.title ?? "");
  state.inStep = true;
  state.stepStartedAt = Date.parse(envelope.ts);
  state.current = [];
  state.logs = [];
}

function endStep(state: PrettyState, envelope: Envelope, data: Record<string, unknown>): void {
  const ms = Math.max(0, Date.parse(envelope.ts) - state.stepStartedAt);
  write(stepLine({ title: String(data.title ?? ""), passed: data.status === "passed", ms }));
  for (const line of state.logs) write(logLine(line));
  for (const failure of state.current) write(reasonLine(failure));
  state.failures.push(...state.current);
  state.current = [];
  state.logs = [];
  state.inStep = false;
}

/**
 * `log "…"` prints under its step, like console output in vitest. An error
 * thrown mid-flow also arrives as a log, and that one is kept for the summary.
 */
function logged(state: PrettyState, data: Record<string, unknown>): void {
  const message = String(data.message ?? "");
  if (data.level === "error") {
    state.failures.push({ flow: state.flow, step: state.step, code: "VN7001", title: message });
  } else {
    state.logs.push(message);
  }
}

function finishRun(state: PrettyState, totals: RunTotals): void {
  write(failuresBlock(state.failures));
  write(summary(totals));
}

function fromProblem(state: PrettyState, data: Record<string, unknown>): Failure {
  const problem = data.problem as Problem;
  return {
    flow: state.flow,
    // A step that already ended is not to blame for what came after it.
    step: state.inStep ? state.step : "",
    code: problem.code,
    title: problem.title,
    location: locationOf(problem),
    diff: problem.diff,
  };
}

function write(text: string): void {
  if (text) process.stdout.write(`${text}\n`);
}

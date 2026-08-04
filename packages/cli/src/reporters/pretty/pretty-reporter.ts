import type { Envelope, Problem, Status, StepId } from "@venn-lang/core";
import { failureIn } from "../failure-kinds.js";
import type { Reporter, RunTotals } from "../reporter.types.js";
import type { Failure, OpenStep, PrettyState } from "./pretty.types.js";
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

/** A step whose envelope carried no id, so it pairs with its own finish. */
const UNNAMED = "" as StepId;

/**
 * A live tree: each file opens a banner, each flow a branch, and each step
 * prints its verdict as soon as it settles. Everything that failed across every
 * file is repeated at the end with its code and source location.
 *
 * @returns The reporter, which writes to stdout as events arrive.
 */
export function createPrettyReporter(): Reporter {
  const state: PrettyState = { flow: "", open: new Map(), failures: [], flowMark: 0 };
  return {
    sink: { emit: (envelope) => handle(envelope, state) },
    beginFile: (file) => {
      state.pendingFile = file;
    },
    finish: (totals) => finishRun(state, totals),
  };
}

function handle(envelope: Envelope, state: PrettyState): void {
  const problem = failureIn(envelope);
  if (problem) {
    failed(state, envelope, problem);
    return;
  }
  const data = envelope.data as Record<string, unknown>;
  if (envelope.kind === "flow.started") beginFlow(state, data);
  else if (envelope.kind === "flow.retrying") retrying(state, envelope);
  else if (envelope.kind === "step.started") beginStep(state, envelope, data);
  else if (envelope.kind === "step.finished") endStep(state, envelope, data);
  else if (envelope.kind === "flow.finished") endFlow(state, envelope);
  else if (envelope.kind === "log") logged(state, envelope, data);
}

/**
 * A failure inside a step waits for that step's verdict, to print under it. One
 * carrying no step belongs to none: a `setup` that blew up before the first step
 * started, or a flow boundary reporting what nobody claimed. Nothing is coming
 * to flush it and no step is to blame for it, so it goes straight to the summary
 * under no step's name.
 */
function failed(state: PrettyState, envelope: Envelope, problem: Problem): void {
  const step = envelope.step ? state.open.get(envelope.step) : undefined;
  const soft = envelope.kind === "expect.soft_failed";
  (step?.failures ?? state.failures).push(fromProblem({ state, step, problem, soft }));
}

function beginFlow(state: PrettyState, data: Record<string, unknown>): void {
  if (state.pendingFile) {
    write(header(state.pendingFile));
    state.pendingFile = undefined;
  }
  state.flow = String(data.title ?? "");
  state.flowMark = state.failures.length;
  write(flowLine(state.flow));
}

/**
 * An attempt `@retry` threw away, whose failures are no account of the run: the
 * step is about to run again and the last attempt is the one that answers for
 * it. A step that ends green must not be summarised under FAILURES for the
 * attempts it took to get there, which is the whole point of retrying a flaky
 * step.
 *
 * The tree above keeps what it already printed, because it is written as the run
 * happens and a line said out loud cannot be taken back. The summary is the
 * account that has to agree with the verdict.
 *
 * The envelope names the step being retried, or names none when the whole flow
 * is: then everything the attempt collected since the flow opened goes with it.
 */
function retrying(state: PrettyState, envelope: Envelope): void {
  const step = envelope.step ? state.open.get(envelope.step) : undefined;
  if (step) {
    forget(step);
    return;
  }
  state.failures.length = Math.min(state.flowMark, state.failures.length);
  for (const one of state.open.values()) forget(one);
}

/** What one discarded attempt collected, dropped: it is not this step's account. */
function forget(step: OpenStep): void {
  step.failures.length = 0;
  step.logs.length = 0;
}

/**
 * A flow closes. `break`, `return` or `exit` can cut it short with steps still
 * open, and what those collected is still worth saying, so they say it as
 * cancelled rather than being dropped with the flow.
 */
function endFlow(state: PrettyState, envelope: Envelope): void {
  for (const step of state.open.values()) {
    flush({ state, step, title: step.title, status: "cancelled", ts: envelope.ts });
  }
  state.open.clear();
  state.flow = "";
}

function beginStep(state: PrettyState, envelope: Envelope, data: Record<string, unknown>): void {
  state.open.set(envelope.step ?? UNNAMED, {
    title: String(data.title ?? ""),
    startedAt: Date.parse(envelope.ts),
    failures: [],
    logs: [],
  });
}

function endStep(state: PrettyState, envelope: Envelope, data: Record<string, unknown>): void {
  const key = envelope.step ?? UNNAMED;
  const step = state.open.get(key);
  state.open.delete(key);
  const title = String(data.title ?? step?.title ?? "");
  flush({ state, step, title, status: data.status as Status, ts: envelope.ts });
}

/** A step's verdict, then the lines and the failures that step collected. */
function flush(args: {
  state: PrettyState;
  step?: OpenStep;
  title: string;
  status: Status;
  ts: string;
}): void {
  const ms = args.step ? Math.max(0, Date.parse(args.ts) - args.step.startedAt) : 0;
  write(stepLine({ title: args.title, status: args.status, ms }));
  for (const line of args.step?.logs ?? []) write(logLine({ message: line, inStep: true }));
  for (const failure of args.step?.failures ?? []) write(reasonLine(failure));
  args.state.failures.push(...(args.step?.failures ?? []));
}

/**
 * `log "…"` prints under its step, like console output in vitest, so it waits
 * for that step's verdict. One emitted outside any step has no verdict coming, so
 * it prints where it happened, beside the steps rather than under the last one.
 */
function logged(state: PrettyState, envelope: Envelope, data: Record<string, unknown>): void {
  const message = String(data.message ?? "");
  const step = envelope.step ? state.open.get(envelope.step) : undefined;
  if (step) step.logs.push(message);
  else write(logLine({ message, inStep: false }));
}

function finishRun(state: PrettyState, totals: RunTotals): void {
  write(failuresBlock(state.failures));
  write(summary(totals));
}

function fromProblem(args: {
  state: PrettyState;
  step?: OpenStep;
  problem: Problem;
  soft: boolean;
}): Failure {
  const { problem, soft } = args;
  const where = { flow: args.state.flow, step: args.step?.title ?? "" };
  const said = { code: problem.code, title: problem.title, location: locationOf(problem) };
  return { ...where, ...said, diff: problem.diff, problem, soft };
}

function write(text: string): void {
  if (text) process.stdout.write(`${text}\n`);
}

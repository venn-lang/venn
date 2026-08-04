import { type Envelope, type Problem, problemLines, type StepId } from "@venn-lang/core";
import { failureIn } from "./failure-kinds.js";
import type { Reporter, RunTotals } from "./reporter.types.js";
import { escapeAttribute, escapeText } from "./xml-escape.js";

/** One step, as the testcase a CI report shows. */
interface Case {
  classname: string;
  name: string;
  /** Its verdict, so a step that was cut short is not reported as a pass. */
  status: string;
  failures: Problem[];
}

/** One file, as the suite its cases are grouped under. */
interface Suite {
  name: string;
  cases: Case[];
  /** What the file took, from its own `run.finished`. */
  ms: number;
}

interface JunitState {
  flow: string;
  /** Every step now running, since `parallel` keeps several open at once. */
  open: Map<StepId, Case>;
  suites: Suite[];
  /** The file the CLI named, before anything in it has a case to be filed under. */
  file: string;
  /** The suite collecting now, made on demand: a file whose flows were all
   * filtered out ran no step and is no part of the report. */
  suite?: Suite;
  /** The testcase this flow's unattributed failures go to, made on demand. */
  loose?: Case;
  /** How many cases the file held when this flow opened, so a discarded attempt
   * of the whole flow can be taken back out again. */
  flowMark: number;
}

/** A step whose envelope carried no id, pairing with its own finish. */
const UNNAMED = "" as StepId;

/** A failure inside no flow at all: a file's own `setup` or `teardown`. */
const LIFECYCLE = "lifecycle";

/**
 * Accumulate every file's steps and emit one JUnit XML document for the run.
 *
 * One `<testsuite>` per file inside a `<testsuites>` root, one `<testcase>` per
 * step, each carrying what failed inside it. The document is written from
 * `finish`, once: written per file instead, `venn test <directory>` produced N
 * concatenated documents, each with its own declaration and its own root, which
 * every XML reader refuses at the second declaration. A `<failure/>` with
 * nothing in it was a well-formed problem thrown away at the last moment, and a
 * report nobody can read anything from is a report nobody reads.
 *
 * @param args.write Where the finished document goes.
 * @returns A reporter that holds the run's steps until the run ends.
 */
export function createJunitReporter(args: { write: (xml: string) => void }): Reporter {
  const state: JunitState = { flow: "", open: new Map(), suites: [], file: "", flowMark: 0 };
  return {
    sink: { emit: (envelope) => handle(envelope, state) },
    beginFile: (file) => beginFile(state, file),
    finish: (totals) => args.write(toJunit(state.suites, totals)),
  };
}

function beginFile(state: JunitState, file: string): void {
  state.file = file;
  state.suite = undefined;
  state.flow = "";
  state.loose = undefined;
  state.flowMark = 0;
}

function handle(envelope: Envelope, state: JunitState): void {
  const problem = failureIn(envelope);
  if (problem) {
    failed(state, envelope, problem);
    return;
  }
  const data = envelope.data as Record<string, unknown>;
  if (envelope.kind === "flow.started") beginFlow(state, data);
  else if (envelope.kind === "flow.retrying") retracted(state, envelope);
  else if (envelope.kind === "step.started") beginStep(state, envelope, data);
  else if (envelope.kind === "step.finished") endStep(state, envelope, data);
  else if (envelope.kind === "flow.finished") endFlow(state);
  else if (envelope.kind === "run.finished") endFile(state, data);
}

function beginFlow(state: JunitState, data: Record<string, unknown>): void {
  state.flow = String(data.title ?? "");
  state.loose = undefined;
  state.flowMark = state.suite?.cases.length ?? 0;
}

/**
 * A flow cut short leaves steps with no verdict coming, and they still count.
 *
 * The flow is forgotten with them. A file's `teardown` fails after the last flow
 * closed and belongs to no flow, so the title of whichever one happened to run
 * last is not its name.
 */
function endFlow(state: JunitState): void {
  for (const one of state.open.values()) {
    one.status = "cancelled";
    suiteOf(state).cases.push(one);
  }
  state.open.clear();
  state.loose = undefined;
  state.flow = "";
}

function endFile(state: JunitState, data: Record<string, unknown>): void {
  if (state.suite) state.suite.ms = Number(data.durationMs ?? 0);
}

function beginStep(state: JunitState, envelope: Envelope, data: Record<string, unknown>): void {
  state.open.set(envelope.step ?? UNNAMED, openCase(state, String(data.title ?? "")));
}

function endStep(state: JunitState, envelope: Envelope, data: Record<string, unknown>): void {
  const key = envelope.step ?? UNNAMED;
  const one = state.open.get(key) ?? openCase(state, "");
  state.open.delete(key);
  one.name = String(data.title ?? one.name);
  one.status = String(data.status ?? "passed");
  suiteOf(state).cases.push(one);
}

/**
 * `@retry` threw an attempt away, so what it collected is no part of the report:
 * the step runs again and the last attempt is the one that answers for it. A step
 * that ends green carrying the `<failure>` children of the attempts before it
 * marks the build red in Jenkins and in GitLab, which is the opposite of what
 * retrying a flaky step is for.
 *
 * The envelope names the step being retried, or names none when the whole flow
 * is: then every case that attempt filed goes with it.
 */
function retracted(state: JunitState, envelope: Envelope): void {
  const step = envelope.step ? state.open.get(envelope.step) : undefined;
  if (step) {
    step.failures.length = 0;
    return;
  }
  const cases = state.suite?.cases;
  if (cases) cases.length = Math.min(state.flowMark, cases.length);
  for (const one of state.open.values()) one.failures.length = 0;
  state.loose = undefined;
}

/**
 * A failure lands on the step that raised it. One carrying no step belongs to no
 * step: a hook, or a flow boundary reporting what nobody claimed. The flow
 * answers for it, under a testcase of its own name.
 */
function failed(state: JunitState, envelope: Envelope, problem: Problem): void {
  const step = envelope.step ? state.open.get(envelope.step) : undefined;
  (step ?? loose(state)).failures.push(problem);
}

function loose(state: JunitState): Case {
  if (!state.loose) {
    state.loose = openCase(state, state.flow || LIFECYCLE);
    suiteOf(state).cases.push(state.loose);
  }
  return state.loose;
}

/** A testcase before any verdict, under the flow that answers for it. */
function openCase(state: JunitState, name: string): Case {
  return { classname: state.flow, name, status: "running", failures: [] };
}

/** The suite this file files under, made the moment the file has anything to file. */
function suiteOf(state: JunitState): Suite {
  if (!state.suite) {
    state.suite = { name: state.file, cases: [], ms: 0 };
    state.suites.push(state.suite);
  }
  return state.suite;
}

function toJunit(suites: readonly Suite[], totals: RunTotals): string {
  const cases = suites.flatMap((suite) => suite.cases);
  const counts = `tests="${cases.length}" failures="${failedIn(cases)}"`;
  const open = `<testsuites ${counts} time="${seconds(totals.ms)}">`;
  const body = suites.map(toSuite).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${open}\n${body ? `${body}\n` : ""}</testsuites>\n`;
}

function toSuite(suite: Suite): string {
  const counts = `tests="${suite.cases.length}" failures="${failedIn(suite.cases)}"`;
  const named = `name="${escapeAttribute(suite.name)}" ${counts} time="${seconds(suite.ms)}"`;
  const body = suite.cases.map(toCase).join("\n");
  return [`  <testsuite ${named}>`, ...(body ? [body] : []), "  </testsuite>"].join("\n");
}

function failedIn(cases: readonly Case[]): number {
  return cases.filter((one) => one.failures.length > 0).length;
}

/** JUnit reads a duration in seconds, however the run measured it. */
function seconds(ms: number): string {
  return (ms / 1000).toFixed(3);
}

function toCase(one: Case): string {
  const named = `classname="${escapeAttribute(one.classname)}" name="${escapeAttribute(one.name)}"`;
  const open = `    <testcase ${named}>`;
  if (one.failures.length > 0) {
    return [open, ...one.failures.map(toFailure), "    </testcase>"].join("\n");
  }
  const cut = one.status === "cancelled" || one.status === "skipped";
  return `${open}${cut ? "<skipped/>" : ""}</testcase>`;
}

/**
 * What the terminal says about a problem, as XML: the title as the message a CI
 * summary shows, the code as the type, and the rest as the element's text. Both
 * surfaces read from `problemLines`, so neither keeps its own idea of a failure.
 */
function toFailure(problem: Problem): string {
  const detail = problemLines(problem).map((line) => `${line.label.padEnd(4)}  ${line.text}`);
  const said = `message="${escapeAttribute(problem.title)}" type="${escapeAttribute(problem.code)}"`;
  return `      <failure ${said}>${escapeText(detail.join("\n"))}</failure>`;
}

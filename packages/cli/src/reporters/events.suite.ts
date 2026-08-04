import type { Envelope } from "@venn-lang/core";
import { vi } from "vitest";

/** The clock every fixture starts at, so a duration is readable in the test. */
export const AT = "2026-07-24T10:00:00.000Z";

/**
 * An envelope as the runtime sends it, `step` and all.
 *
 * @param args.kind The event name.
 * @param args.data Its payload.
 * @param args.step The run of the step it happened inside, absent when none.
 * @param args.ts When it happened, defaulting to {@link AT}.
 * @returns The envelope, cast because a fixture spells only what it uses.
 */
export function envelope(args: {
  kind: string;
  data: unknown;
  step?: string;
  ts?: string;
}): Envelope {
  const { kind, data, step } = args;
  return { seq: 1, ts: args.ts ?? AT, run: "run-1", kind, data, step } as unknown as Envelope;
}

/**
 * A flow opening.
 *
 * @param title What it is called.
 * @returns The `flow.started` envelope.
 */
export function flow(title: string): Envelope {
  return envelope({ kind: "flow.started", data: { title } });
}

/**
 * A flow settling.
 *
 * @param args.title What it is called.
 * @param args.status Its verdict, or `cancelled` when something cut it short.
 * @returns The `flow.finished` envelope.
 */
export function flowDone(args: { title: string; status?: string }): Envelope {
  const data = { title: args.title, status: args.status ?? "passed" };
  return envelope({ kind: "flow.finished", data });
}

/**
 * An attempt `@retry` threw away, so another one follows it.
 *
 * @param args.title The step, or the flow, that is about to run again.
 * @param args.attempt Which attempt just failed, counted from one.
 * @param args.step The step being retried, absent when a whole flow is.
 * @returns The `flow.retrying` envelope.
 */
export function retrying(args: { title: string; attempt?: number; step?: string }): Envelope {
  const data = { title: args.title, attempt: args.attempt ?? 1, reason: "previous attempt failed" };
  return envelope({ kind: "flow.retrying", data, step: args.step });
}

/**
 * A step opening, carrying the id the runtime minted for this run of it.
 *
 * @param args.title What it is called.
 * @param args.step Its id, absent to test an envelope that carries none.
 * @param args.ts When it started.
 * @returns The `step.started` envelope.
 */
export function started(args: { title: string; step?: string; ts?: string }): Envelope {
  const { step, ts } = args;
  return envelope({ kind: "step.started", data: { title: args.title }, step, ts });
}

/**
 * A step settling.
 *
 * @param args.title What it is called.
 * @param args.status Its verdict, `passed` unless said otherwise.
 * @param args.step Its id, which has to match its start to pair with it.
 * @param args.ts When it settled, which decides the duration printed.
 * @returns The `step.finished` envelope.
 */
export function finished(args: {
  title: string;
  status?: string;
  step?: string;
  ts?: string;
}): Envelope {
  const data = { title: args.title, status: args.status ?? "passed" };
  return envelope({ kind: "step.finished", data, step: args.step, ts: args.ts });
}

/**
 * A failure on one of the three envelopes it may travel on.
 *
 * @param args.problem What went wrong.
 * @param args.kind Which envelope carries it, `expect.failed` by default.
 * @param args.step The step that raised it, absent when none did.
 * @returns The envelope carrying the problem.
 */
export function raised(args: { problem: unknown; kind?: string; step?: string }): Envelope {
  const kind = args.kind ?? "expect.failed";
  return envelope({ kind, data: { problem: args.problem }, step: args.step });
}

/**
 * Something the program said, and nothing that went wrong.
 *
 * @param args.message What it said.
 * @param args.step The step that said it, absent when it was said outside one.
 * @returns The `log` envelope.
 */
export function said(args: { message: string; step?: string }): Envelope {
  const data = { level: "info", message: args.message };
  return envelope({ kind: "log", data, step: args.step });
}

/**
 * The run ending, which is what makes a machine reporter say anything.
 *
 * @param args.passed How many passed.
 * @param args.failed How many failed.
 * @returns The `run.finished` envelope.
 */
export function runDone(args: { passed: number; failed: number }): Envelope {
  const data = { passed: args.passed, failed: args.failed, durationMs: 12 };
  return envelope({ kind: "run.finished", data });
}

/**
 * Everything written to stdout while something runs.
 *
 * @param run What to drive, with stdout already captured.
 * @returns Every chunk written, joined.
 */
export function captureStdout(run: () => void): string {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    run();
  } finally {
    spy.mockRestore();
  }
  return chunks.join("");
}

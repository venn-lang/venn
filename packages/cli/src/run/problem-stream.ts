import type { Host } from "@venn-lang/contracts";
import type { Envelope, Problem, RunId } from "@venn-lang/core";
import { type EventSink, newRunId } from "@venn-lang/runtime";
import type { Numbering, ProblemStream } from "./problem-stream.types.js";

/** The run's ending, kept back until this file has said everything it found. */
interface Held {
  finish?: Envelope;
}

/**
 * The one channel a failure travels on, opened for a file before it runs.
 *
 * A problem found before the run is the same news as one found during it, and
 * only the second ever reached a reporter: the first went to stderr, so a junit
 * document reported a clean suite for a run the command exited 1 on. Everything
 * a reporter is given now comes from here.
 *
 * @param args.sink Where the reporters are listening.
 * @param args.host The clock, and the random a run id is drawn from when this
 * has to mint one of its own.
 * @returns The sink to run through, the way to say what stopped it, and the way
 * to let the run's ending out once it is said.
 */
export function problemStream(args: { sink: EventSink; host: Host }): ProblemStream {
  const at: Numbering = { seq: 0 };
  const held: Held = {};
  return {
    sink: { emit: (envelope) => forward({ at, held, envelope, sink: args.sink }) },
    say: (problems) => say({ at, problems, sink: args.sink, host: args.host }),
    close: () => close({ at, held, sink: args.sink }),
  };
}

/**
 * The run's own numbering, taken as it passes, so a problem said after the run
 * follows it rather than starting again at one.
 *
 * `run.finished` is held here instead. The runtime guarantees it is the last
 * thing a run emits and every consumer reads it that way, closing its file on
 * it; this channel then put the file's own refusals after it, so a decorator
 * that refused the program at expansion time landed past the ending and a
 * reader that stopped there called the run green.
 */
function forward(args: { at: Numbering; held: Held; envelope: Envelope; sink: EventSink }): void {
  args.at.run = args.envelope.run;
  if (args.envelope.kind === "run.finished") {
    args.held.finish = args.envelope;
    return;
  }
  args.at.seq = args.envelope.seq;
  args.sink.emit(args.envelope);
}

/** The ending, renumbered so it still follows whatever was said in front of it. */
function close(args: { at: Numbering; held: Held; sink: EventSink }): void {
  const finish = args.held.finish;
  if (!finish) return;
  args.held.finish = undefined;
  args.at.seq += 1;
  args.sink.emit({ ...finish, seq: args.at.seq });
}

function say(args: {
  at: Numbering;
  problems: readonly Problem[];
  sink: EventSink;
  host: Host;
}): void {
  // Never at construction: minting draws from the seeded random the program reads.
  const run = args.at.run ?? newRunId(args.host);
  args.at.run = run;
  for (const problem of args.problems) {
    args.at.seq += 1;
    const ts = new Date(args.host.clock.now()).toISOString();
    args.sink.emit(raised({ seq: args.at.seq, run, problem, ts }));
  }
}

/**
 * `failure` and not one of the two assertion envelopes: nothing was asserted,
 * the file was refused.
 */
function raised(args: {
  seq: number;
  run: RunId;
  problem: Problem;
  ts: string;
}): Envelope<"failure"> {
  const { seq, ts, run, problem } = args;
  return { seq, ts, run, kind: "failure", data: { problem } };
}

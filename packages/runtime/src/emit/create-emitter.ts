import type { Clock } from "@venn-lang/contracts";
import type { Envelope, RunId, StepId } from "@venn-lang/core";
import type { EventSink } from "../eventsink/index.js";
import type { Emitter } from "./emitter.types.js";

/** Build the sole emitter: it owns `seq` and stamps `ts` from the runner's clock. */
export function createEmitter(args: { sink: EventSink; run: RunId; clock: Clock }): Emitter {
  let seq = 0;
  let steps = 0;
  return {
    emit: ({ kind, data, node, step }) => {
      seq += 1;
      const ts = new Date(args.clock.now()).toISOString();
      args.sink.emit({ seq, ts, run: args.run, kind, node, step, data } as Envelope);
    },
    nextStep: () => {
      steps += 1;
      return `s${steps}` as StepId;
    },
  };
}

/**
 * The emitter a step hands its body: the parent's, with this step stamped on.
 *
 * Attribution has to be structural rather than remembered. `parallel` opens two
 * steps at once by design, so a reporter cannot infer which one an event
 * belongs to from the order it arrived in, and eleven emit sites cannot each be
 * relied on to pass an id they would have to be given first.
 *
 * An id already on the envelope wins over the stamp, because the parent of a
 * step reached through another step is itself one of these: without that, a
 * fragment's steps all arrived under the id of the step that ran the fragment,
 * and a reporter keyed by step id lost the outer step's lines and reported a
 * failed step as green.
 *
 * @param parent The emitter this step was reached through.
 * @param step The identity minted for this run of it.
 * @returns An emitter that stamps `step` on anything not already attributed,
 * minting nested ids from the parent so a step inside a step is still unique.
 */
export function stepEmitter(parent: Emitter, step: StepId): Emitter {
  return {
    emit: (envelope) => parent.emit({ ...envelope, step: envelope.step ?? step }),
    nextStep: () => parent.nextStep(),
  };
}

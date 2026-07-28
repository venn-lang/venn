import type { Clock } from "@venn-lang/contracts";
import type { Envelope, RunId } from "@venn-lang/core";
import type { EventSink } from "../eventsink/index.js";
import type { Emitter } from "./emitter.types.js";

/** Build the sole emitter: it owns `seq` and stamps `ts` from the runner's clock. */
export function createEmitter(args: { sink: EventSink; run: RunId; clock: Clock }): Emitter {
  let seq = 0;
  return {
    emit: ({ kind, data, node }) => {
      seq += 1;
      const ts = new Date(args.clock.now()).toISOString();
      args.sink.emit({ seq, ts, run: args.run, kind, node, data } as Envelope);
    },
  };
}

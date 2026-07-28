import type { Envelope, RunId } from "@venn/core";
import { describe, expect, it } from "vitest";
import type { EventSink } from "./event-sink.types.js";

/** One EventSink implementation plus a way to read back what it received. */
export interface EventSinkSpec {
  name: string;
  make(): { sink: EventSink; drain(): Envelope[] };
}

function logEnvelope(seq: number): Envelope {
  return { seq, ts: "", run: "r" as RunId, kind: "log", data: { level: "info", message: "x" } };
}

/** The EventSink TCK, satisfied by both memory and ndjson. */
export function eventSinkConformance(spec: EventSinkSpec): void {
  describe(`EventSink · ${spec.name}`, () => {
    it("records emitted envelopes in seq order", () => {
      const { sink, drain } = spec.make();
      sink.emit(logEnvelope(1));
      sink.emit(logEnvelope(2));
      sink.emit(logEnvelope(3));
      expect(drain().map((envelope) => envelope.seq)).toEqual([1, 2, 3]);
    });
  });
}

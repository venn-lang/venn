import type { EventData, EventKind } from "./event-data.types.js";
import type { NodePath, RunId } from "./ids.types.js";

/** The single contract between runner, host, and UI. Everything else derives from it. */
export interface Envelope<K extends EventKind = EventKind> {
  /** Monotonic per run; the UI detects a gap and asks for a resync. */
  seq: number;
  /** ISO-8601 with milliseconds, from the runner's clock. */
  ts: string;
  run: RunId;
  kind: K;
  node?: NodePath;
  parent?: NodePath;
  /** Which parallel worker emitted this, so interleaved output can be split. */
  worker?: number;
  data: EventData[K];
}

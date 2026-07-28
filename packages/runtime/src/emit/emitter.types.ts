import type { EventData, EventKind, NodePath } from "@venn-lang/core";

/** The single place `seq` increments and `ts` is stamped. Handlers emit only here. */
export interface Emitter {
  emit<K extends EventKind>(args: { kind: K; data: EventData[K]; node?: NodePath }): void;
}

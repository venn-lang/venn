import type { EventData, EventKind, NodePath, StepId } from "@venn-lang/core";

/** The single place `seq` increments and `ts` is stamped. Handlers emit only here. */
export interface Emitter {
  emit<K extends EventKind>(args: {
    kind: K;
    data: EventData[K];
    node?: NodePath;
    /**
     * Which run of which step this belongs to. Never passed by hand: a step
     * hands its body an emitter that stamps it, so everything the body emits is
     * attributed without every callsite having to remember. One already here
     * stands, so a step reached through another step keeps its own id.
     */
    step?: StepId;
  }): void;
  /** A fresh identity, for the step that is starting now. */
  nextStep(): StepId;
}

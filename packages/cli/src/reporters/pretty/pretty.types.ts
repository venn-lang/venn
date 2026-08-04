import type { Diff, Problem, StepId } from "@venn-lang/core";

/** One thing that went wrong, kept for the summary printed after the tree. */
export interface Failure {
  flow: string;
  step: string;
  code: string;
  title: string;
  location?: string;
  /** The two sides compared, shown as the failure's body. */
  diff?: Diff;
  /** The problem whole, so the block can say what it knows beneath the title. */
  problem?: Problem;
  /** Whether the step was asked to record this one and carry on. */
  soft?: boolean;
}

/**
 * A step that has started and not yet reported its verdict.
 *
 * `parallel` and `race` are kernel statements, so several of these are open at
 * once by design. What each one collected has to be its own, or one step's log
 * prints under another's name.
 */
export interface OpenStep {
  title: string;
  /** Milliseconds since the epoch, from the `step.started` envelope's clock. */
  startedAt: number;
  failures: Failure[];
  /** `log` messages emitted inside this step, held for its verdict. */
  logs: string[];
}

/** What the reporter tracks while events stream in. */
export interface PrettyState {
  /** The file whose banner has not been printed yet. A file with no matching
   * flow never prints one, so filters stay quiet. */
  pendingFile?: string;
  flow: string;
  /** Every step now running, by the id the runtime minted for that run of it. */
  open: Map<StepId, OpenStep>;
  failures: Failure[];
  /** How many failures were collected when this flow opened, so a `@retry` that
   * discarded the whole flow can take that attempt's own back out. */
  flowMark: number;
}

import type { Diff } from "@venn-lang/core";

/** One thing that went wrong, kept for the summary printed after the tree. */
export interface Failure {
  flow: string;
  step: string;
  code: string;
  title: string;
  location?: string;
  /** The two sides compared, shown as the failure's body. */
  diff?: Diff;
}

/** What the reporter tracks while events stream in. */
export interface PrettyState {
  /** The file whose banner has not been printed yet. A file with no matching
   * flow never prints one, so filters stay quiet. */
  pendingFile?: string;
  flow: string;
  step: string;
  /** Whether a step is open. A failure outside one belongs to no step. */
  inStep: boolean;
  stepStartedAt: number;
  /** Failures seen in the step currently running. */
  current: Failure[];
  /** `log` messages emitted during the step currently running. */
  logs: string[];
  failures: Failure[];
}

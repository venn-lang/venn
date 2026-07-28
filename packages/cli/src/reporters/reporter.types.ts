import type { EventSink } from "@venn-lang/runtime";

/** Totals across every file a single `venn run` covered. */
export interface RunTotals {
  passed: number;
  failed: number;
  files: number;
  ms: number;
  /** Set when a file called `exit`: the code the whole command leaves with. */
  exitCode?: number;
}

/**
 * A reporter is an event sink plus the two moments the CLI owns: which file is
 * starting, and that the whole run is over. Machine formats ignore both.
 */
export interface Reporter {
  sink: EventSink;
  beginFile(file: string): void;
  finish(totals: RunTotals): void;
}

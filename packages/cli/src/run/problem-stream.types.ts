import type { Problem, RunId } from "@venn-lang/core";
import type { EventSink } from "@venn-lang/runtime";

/** Where a file's numbering has got to: the run it belongs to, and its last `seq`. */
export interface Numbering {
  seq: number;
  /**
   * Absent until the run mints one, or until a problem is said with no run to
   * belong to. Never minted ahead of that: minting draws from the host's
   * random, and a draw the program did not make moves every number it reads.
   */
  run?: RunId;
}

/** One file's event stream, and the compile problems that belong on it. */
export interface ProblemStream {
  /** What the run emits through, so the numbering below stays this run's own. */
  sink: EventSink;
  /**
   * Put these on the stream, as the failures they are.
   *
   * @param problems What the file was refused for, in the order it was found.
   */
  say(problems: readonly Problem[]): void;
  /**
   * Let the run's ending out, now that this file has nothing left to say.
   *
   * Idempotent, and nothing at all when no run ever finished.
   */
  close(): void;
}

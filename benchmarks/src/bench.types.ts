/**
 * One workload, written twice: once in Venn, once in TypeScript.
 *
 * The two must be the *same algorithm*, not merely the same answer. Venn has no
 * assignment, so the TypeScript twin does not use one either — otherwise the
 * ratio would measure a difference in program, not a difference in engine.
 */
export interface BenchCase {
  name: string;
  /** What the case is meant to stress, for the report. */
  stresses: string;
  /** The `.vn` file under `cases/`, run in script mode. */
  vn: string;
  /** The TypeScript twin. Its value, stringified, must equal what Venn prints. */
  ts: () => unknown;
  /** Timed repetitions, after `warmup` untimed ones. */
  reps: number;
  warmup: number;
}

/** What one side of a case measured, in milliseconds. */
export interface Timing {
  median: number;
  min: number;
  mean: number;
  samples: number;
}

/** A case, measured on every runtime available. */
export interface CaseResult {
  name: string;
  stresses: string;
  ts: Timing;
  vn: Timing;
  /** Milliseconds to parse and type-check the Venn source, measured once. */
  compile: number;
  /** Both sides produced the same answer — without this the numbers mean nothing. */
  agrees: boolean;
  /** The same workload timed by Python, when a Python is installed. */
  python?: number;
}

/** Cold wall-clock of a whole process, the thing a person actually waits for. */
export interface StartupResult {
  /** Which binary ran both sides — whatever launched this harness. */
  runtime: string;
  script: Timing;
  venn: Timing;
  /** The same fib(25) as its own Python process, when a Python is installed. */
  python?: Timing;
}

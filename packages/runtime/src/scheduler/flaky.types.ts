/** Per-node flakiness tally, accumulated across executions and settled once. */
export interface FlakyTally {
  ratio: number;
  runs: number;
  failedRuns: number;
  failedUnits: number;
}

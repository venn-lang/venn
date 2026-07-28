/**
 * One field of a structured comparison. Fields that agree are carried too: what
 * makes a diff readable is the one line that moved standing among the ones that
 * did not.
 */
export interface DiffEntry {
  /** Where the field sits under the subject: `.status`, `[2]`, `.items[0].id`. */
  path: string;
  expected: string;
  actual: string;
  same: boolean;
}

/** Structured expected-vs-actual (§16), never a `toString`. */
export type Diff =
  | { kind: "scalar"; expected: string; actual: string }
  | { kind: "json"; path: string; expected: unknown; actual: unknown }
  | { kind: "text"; expected: string; actual: string }
  /** The two sides walked field by field; a list position counts as a field. */
  | { kind: "fields"; label: string; entries: readonly DiffEntry[] };

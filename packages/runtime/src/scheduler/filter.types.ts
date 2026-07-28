/** Which flows and steps a run includes. Absent fields mean "no restriction". */
export interface RunFilter {
  /** Keep flows carrying at least one of these `@tags`. */
  tags?: readonly string[];
  /** Keep flows whose title contains this text, case-insensitively. */
  flow?: string;
  /** Keep steps whose title contains this text, case-insensitively. */
  step?: string;
}

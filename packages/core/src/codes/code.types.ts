import type { Severity } from "../problem/index.js";

/** A catalog entry: a stable code plus its default severity. */
export interface CodeSpec {
  code: string;
  severity: Severity;
}

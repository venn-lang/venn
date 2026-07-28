import type { Diff } from "./diff.types.js";
import type { RelatedInfo } from "./related.types.js";
import type { Severity } from "./severity.types.js";
import type { Span } from "./span.types.js";

/**
 * The single shape shared by compile diagnostics and runtime failures, so one
 * renderer serves terminal, editor, and UI (§16). Optional fields are populated
 * as each producer has the information.
 */
export interface Problem {
  code: string;
  severity: Severity;
  title: string;
  span: Span;
  help?: string;
  related?: RelatedInfo[];
  diff?: Diff;
  note?: string;
  docs?: string;
}

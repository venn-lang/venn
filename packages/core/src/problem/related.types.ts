import type { Span } from "./span.types.js";

/** A secondary location, e.g. "here it was declared as…". */
export interface RelatedInfo {
  span: Span;
  label: string;
}

import type { DecoDecl } from "@venn/core";
import type { LangiumDocument } from "langium";

/**
 * One decorator a `@name` could mean here: a `deco` some file declares, or one
 * the language ships with.
 *
 * `decorates` is in the language's own words (`Fn`, `Flow`, `Step`), never a
 * node type. What a decorator applies to is part of its signature, so reading
 * one costs nobody a lesson in the compiler's vocabulary.
 */
export interface DecoInfo {
  name: string;
  /** The kinds it may sit on. Empty means it constrains nothing. */
  decorates: readonly string[];
  /** The line a hover fences: `pub deco retry(target: Flow, times: number)`. */
  signature: string;
  doc?: string;
  /** The declaration, when a `.vn` declares it: where go-to-definition lands. */
  decl?: DecoDecl;
  /** The document holding {@link decl}. Absent for a built-in. */
  document?: LangiumDocument;
}

import type { Analysis } from "@venn-lang/runtime";
import type { LangiumDocument } from "langium";

/**
 * What the front end worked out for one document: its problems, every node's
 * type, and the expressions parsed out of each `${…}`.
 *
 * The runtime's `Analysis` under the editor's name for it. The validator reads
 * the problems and hover reads the types, from the same cached object, so the
 * two can never be looking at different answers.
 */
export type DocumentTypes = Analysis;

/**
 * Analysis for the workspace, computed once per parse of a document.
 *
 * Analysing walks a whole file, and several features want its result:
 * diagnostics on every edit, hover on every mouse move. Without a shared cache
 * the same file is re-checked many times per keystroke; with it, a file is
 * checked once when it changes and every reader is served from memory.
 */
export interface TypeService {
  /** Everything the front end knows about this document, cached until it is reparsed. */
  of(document: LangiumDocument): DocumentTypes;
  /** What is already cached, or undefined, for readers that must not block. */
  peek(document: LangiumDocument): DocumentTypes | undefined;
  /** Forget a document: it was deleted, or its folder was closed. */
  forget(uri: string): void;
}

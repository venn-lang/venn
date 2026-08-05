/** The little of a Langium CST node a span is built from. */
export interface SpanNode {
  $cstNode?: {
    offset?: number;
    length?: number;
    text?: string;
    range?: { start?: { line?: number; character?: number } };
    /** The whole file the node was parsed in, which says whether a mark opens it. */
    root?: { fullText?: string };
  };
}

/**
 * Where a `${…}` was written, for an expression parsed apart from its file.
 *
 * A slot is parsed as its own little document, so its nodes carry that
 * document's offsets and know nothing of the file the string sits in. This is
 * everything needed to put them back: the string that held the slot, and where
 * inside it the slot's source begins.
 */
export interface SlotOrigin {
  /** Where the containing string literal starts in the file. */
  offset: number;
  /** The string literal's own source text, quotes and all. */
  text: string;
  /** Where the slot's source begins within that text. */
  start: number;
  /** The 1-based line the string literal starts on. */
  line: number;
  /** The 1-based column the string literal starts at. */
  column: number;
}

/**
 * One `${…}` placeholder found inside a string, located precisely enough to
 * highlight, hover and jump to what is written inside it.
 *
 * Offsets are relative to the text handed to the scanner, so the runtime can
 * scan the cooked value while the language server scans the raw source token.
 * One description of what `${…}` means, serving both.
 */
export interface InterpolationSlot {
  /** Offset of the opening `${`. */
  start: number;
  /** Offset just past the closing `}`. */
  end: number;
  /** The expression source between the braces, trimmed. */
  source: string;
  /** Offset of {@link source} itself, past `${` and any leading blanks. */
  sourceStart: number;
}

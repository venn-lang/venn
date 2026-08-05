/**
 * Where a Problem points, read off an offset into the source.
 *
 * The one answer for this folder. An explainer that reads the text rather than a
 * token has no node to hand {@link spanOf}, and every one of them needs the same
 * three numbers, so the arithmetic lives once: it is off-by-one shaped, and the
 * case it goes wrong on is the first character of a file, which is the case no
 * fixture covers.
 *
 * Counted from what lies before the offset rather than from the line start
 * backwards. `lastIndexOf("\n", offset - 1)` reads a negative `from` as `0`, so
 * at offset `0` it can match the newline a file opens with and answer line 2,
 * column 0 for the very first character.
 */

import { shownColumn } from "../lang/index.js";
import type { Span } from "../problem/index.js";

/**
 * Where the line holding an offset begins.
 *
 * @param text The whole source.
 * @param offset An index into it.
 * @returns The index of the first character of that line, `0` for the first.
 */
export function lineStart(text: string, offset: number): number {
  return offset > 0 ? text.lastIndexOf("\n", offset - 1) + 1 : 0;
}

/**
 * The line and column a reader sees for an offset.
 *
 * @param text The whole source, which is also what says whether a byte-order
 * mark is being counted: the offset counts it and the column does not.
 * @param offset An index into it.
 * @returns Both 1-based, with any mark taken back off the column.
 */
export function placeAt(text: string, offset: number): { line: number; column: number } {
  const start = lineStart(text, offset);
  const line = lineOf(text, start);
  return { line, column: shownColumn({ text, line, column: offset - start + 1 }) };
}

/**
 * A span an explainer found in the source rather than on a token.
 *
 * @param args The whole source, the uri to record on the span, the offset the
 * mistake is at, and how much of it to underline.
 * @returns The offset and length as given, and the place a reader sees.
 */
export function spanAt(args: { text: string; uri: string; offset: number; length: number }): Span {
  return {
    uri: args.uri,
    offset: args.offset,
    length: args.length,
    ...placeAt(args.text, args.offset),
  };
}

/** Which line an index falls on, counted without cutting the file up to reach it. */
function lineOf(text: string, start: number): number {
  let line = 1;
  for (let at = text.indexOf("\n"); at !== -1 && at < start; at = text.indexOf("\n", at + 1)) {
    line += 1;
  }
  return line;
}

import { EXPRESSION_OFFSET } from "../parse/index.js";
import type { Span } from "../problem/index.js";
import { slotOrigin } from "./slot-origin.js";
import type { SlotOrigin, SpanNode } from "./span.types.js";

/**
 * Where a node sits in its file, for a Problem that has to point at it.
 *
 * The one answer to that question. An expression parsed out of a `${…}` carries
 * the offsets of the little document it was parsed in, and is put back here, so
 * every check reports a slot at the slot rather than at a constant.
 *
 * @param node Any node with a CST, from the file or from inside a placeholder.
 * @param uri The file the span is reported against.
 * @returns The offset, length, line and column, all of them the file's own.
 */
export function spanOf(node: SpanNode, uri: string): Span {
  const cst = node.$cstNode;
  const offset = cst?.offset ?? 0;
  const length = cst?.length ?? 0;
  const origin = slotOrigin(node);
  if (origin) return inSlot({ origin, uri, offset, length });
  const start = cst?.range?.start;
  return { uri, offset, length, line: (start?.line ?? 0) + 1, column: (start?.character ?? 0) + 1 };
}

/**
 * A node from a placeholder, put back where it was written.
 *
 * The slot was parsed wrapped in a prefix, so its offsets begin inside that
 * wrapper. Subtracting the wrapper gives an index into the slot's source, and
 * the origin says where that source sits inside the string, and the string
 * inside the file.
 */
function inSlot(args: { origin: SlotOrigin; uri: string; offset: number; length: number }): Span {
  const within = Math.max(0, args.origin.start + (args.offset - EXPRESSION_OFFSET));
  return {
    uri: args.uri,
    offset: args.origin.offset + within,
    length: args.length,
    ...placeOf(args.origin, within),
  };
}

/** Line and column of an index into the string literal that holds the slot. */
function placeOf(origin: SlotOrigin, within: number): { line: number; column: number } {
  const before = origin.text.slice(0, within);
  const breaks = before.split("\n").length - 1;
  if (breaks === 0) return { line: origin.line, column: origin.column + within };
  return { line: origin.line + breaks, column: within - before.lastIndexOf("\n") };
}

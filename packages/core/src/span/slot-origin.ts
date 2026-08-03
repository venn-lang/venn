import type { SlotOrigin, SpanNode } from "./span.types.js";

/**
 * Hidden rather than a field, because the AST is walked, compared and rendered
 * everywhere, and an origin is bookkeeping about where a node was parsed rather
 * than part of what the program says.
 */
const ORIGIN = Symbol.for("venn.slotOrigin");

/** How far up a container chain an origin is looked for before giving up. */
const DEPTH = 64;

/**
 * Say where a placeholder's expression was written.
 *
 * Marked on the slot's root only: everything under it reaches the mark by
 * walking out, and the root's own container is the string literal, so the walk
 * stops there rather than wandering into the file.
 *
 * @param args The parsed expression, the string literal that holds it, and
 * where the slot's source begins inside that literal's text.
 */
export function markSlotIn(args: { expr: object; host: SpanNode; start: number }): void {
  const cst = args.host.$cstNode;
  if (!cst || cst.text === undefined) return;
  const start = cst.range?.start;
  const origin: SlotOrigin = {
    offset: cst.offset ?? 0,
    text: cst.text,
    start: args.start,
    line: (start?.line ?? 0) + 1,
    column: (start?.character ?? 0) + 1,
  };
  Object.defineProperty(args.expr, ORIGIN, { value: origin, configurable: true });
}

/** The `${…}` this node was parsed out of, or undefined for ordinary code. */
export function slotOrigin(node: object): SlotOrigin | undefined {
  let at: { $container?: object } | undefined = node;
  for (let step = 0; at && step < DEPTH; step += 1) {
    const found = (at as Record<symbol, unknown>)[ORIGIN];
    if (found) return found as SlotOrigin;
    at = at.$container;
  }
  return undefined;
}

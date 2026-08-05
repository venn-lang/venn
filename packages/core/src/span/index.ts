/**
 * Where a node is, said once.
 *
 * Every Problem points at something, and three copies of "read the CST offset"
 * used to answer that. One of them also had to know about `${…}`, which the
 * other two silently did not, so a type error inside a placeholder was reported
 * at a constant position. There is one now, and it knows.
 */

export { spanOf } from "./node-span.js";
export { markSlotIn, slotOrigin } from "./slot-origin.js";
export { slotSpan } from "./slot-span.js";
export type { SlotOrigin, SpanNode } from "./span.types.js";

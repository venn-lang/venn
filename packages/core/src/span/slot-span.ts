import type { InterpolationSlot } from "../interpolation/index.js";
import type { Span } from "../problem/index.js";
import { shownPlace } from "./shown-place.js";
import type { SpanNode } from "./span.types.js";

/**
 * Where a `${…}` placeholder sits in the file that holds it.
 *
 * The other half of {@link spanOf}: that one places a node parsed *out of* a
 * placeholder, and this one places the placeholder itself, for a problem about
 * the slot rather than about anything inside it. Both are here because a
 * placeholder reported at the whole string is a squiggle over a URL when what
 * is wrong is nine characters of it.
 *
 * Line and column follow the string's own start rather than being counted
 * through its text, so a slot on the second line of a multi-line string is
 * placed at the string's line. That is deliberate: the caller has the offset
 * and the length, which is what an editor ranges with.
 *
 * @param args The placeholder, the string literal holding it, and the file.
 * @returns The span of the placeholder, `${` and `}` included.
 */
export function slotSpan(args: { slot: InterpolationSlot; host: SpanNode; uri: string }): Span {
  const cst = args.host.$cstNode;
  const place = shownPlace(cst);
  return {
    uri: args.uri,
    offset: (cst?.offset ?? 0) + args.slot.start,
    length: args.slot.end - args.slot.start,
    line: place.line,
    column: place.column + args.slot.start,
  };
}

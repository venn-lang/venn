import type { InterpolationSlot } from "./interpolation.types.js";

/**
 * Find every `${…}` placeholder in a string.
 *
 * The single description of where interpolation starts and stops: the evaluator
 * substitutes what this returns, and the language server colours, hovers and
 * resolves the very same spans. An unclosed `${` ends the scan, so the text
 * after it is ordinary characters.
 *
 * @returns The slots, in the order they appear.
 */
export function scanInterpolations(text: string): InterpolationSlot[] {
  const slots: InterpolationSlot[] = [];
  let open = text.indexOf("${");
  while (open !== -1) {
    const close = placeholderEnd(text, open);
    if (close === -1) break;
    slots.push(slotAt({ text, open, close }));
    open = text.indexOf("${", close + 1);
  }
  return slots;
}

/**
 * Where the `${` at `open` closes, counting nesting so `${ {a:1}.a }` works.
 *
 * @param text The text the placeholder is written in.
 * @param open The offset of its `${`.
 * @returns The offset of the `}`, or `-1` when nothing in the text closes it.
 */
export function placeholderEnd(text: string, open: number): number {
  let depth = 1;
  for (let index = open + 2; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Where a `${` opens a placeholder the text never closes.
 *
 * The other side of {@link scanInterpolations}, which stops at one and leaves
 * the rest as ordinary characters. Asking for it by itself is what lets the
 * parse layer say a string ended in the middle of one.
 *
 * @param text The text to read, a string literal's own characters included.
 * @returns The offset of the `${`, or nothing when every placeholder closes.
 */
export function unclosedPlaceholder(text: string): number | undefined {
  let open = text.indexOf("${");
  while (open !== -1) {
    const close = placeholderEnd(text, open);
    if (close === -1) return open;
    open = text.indexOf("${", close + 1);
  }
  return undefined;
}

function slotAt(args: { text: string; open: number; close: number }): InterpolationSlot {
  const inner = args.text.slice(args.open + 2, args.close);
  const lead = inner.length - inner.trimStart().length;
  return {
    start: args.open,
    end: args.close + 1,
    source: inner.trim(),
    sourceStart: args.open + 2 + lead,
  };
}

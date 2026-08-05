/**
 * The comma that a broken line inside `( )` or `[ ]` still needs.
 *
 * The lexer drops newlines inside those brackets, on purpose, so a long call
 * may be written over several lines. The cost is that the one thing a reader
 * put between two arguments is gone before the parser sees them, and the parser
 * cannot name what it never received.
 *
 * The worst shape is the report itself. `print` alone is already a whole
 * `ActionCall` and therefore a whole `Declaration`, so a `print(` whose
 * arguments do not parse leaves the parser having already finished the file,
 * and the `(` on line one becomes rubbish after the end of it. The message then
 * blames a bracket several lines above the missing comma. Reported here at the
 * item that needed the comma instead.
 */

import type { Explained, ParserStop } from "./explained.types.js";
import { expectedNames } from "./said-error.js";
import { COMMA_IN_BRACKETS } from "./separator-words.js";

/** The brackets the lexer takes the newlines out of. */
const OPENERS = new Set(["(", "["]);

/** What the parser asks for when one of those has run out of items. */
const CLOSERS = new Set([")", "]"]);

/** What a parser that has already finished the file asks for. */
const END = "EOF";

/**
 * Two items with nothing but a line break or a `;` between them.
 *
 * The lead character rules out a break that follows an opener, and the
 * lookahead rules out one that runs into a closer, since neither of those
 * stands between two items.
 */
const A_BREAK = /[^\s,([{]\s*[\n;][\s;]*(?=[^\s,)\]}])/;

/** How much to underline: the item that wanted the comma, and not what follows it. */
const AN_ITEM = /^[^\s,)\]}]+/;

/**
 * A title in the language's own words, when this is that error.
 *
 * @param stop Where the parser gave up, and what it was inside when it did.
 * @returns The line to print and where to point it, or nothing when the parser
 * did not stop for want of a comma inside a bracket.
 */
export function commaInBrackets(stop: ParserStop): Explained | undefined {
  return atTheItem(stop) ?? insideTheCall(stop);
}

/**
 * The parser asked for the closing bracket and was handed another item.
 *
 * It already points at that item, so here only the sentence was wrong.
 */
function atTheItem(stop: ParserStop): Explained | undefined {
  const expected = expectedNames(stop.message);
  if (expected.length !== 1 || !CLOSERS.has(expected[0] ?? "")) return undefined;
  if (stop.token === "" || !Number.isFinite(stop.offset)) return undefined;
  return { title: COMMA_IN_BRACKETS };
}

/**
 * The parser asked for the end of the file and was handed a bracket.
 *
 * That bracket belongs to a call it had already finished without one, so the
 * mistake is inside it and the report has to be moved there.
 */
function insideTheCall(stop: ParserStop): Explained | undefined {
  if (!OPENERS.has(stop.token) || expectedNames(stop.message)[0] !== END) return undefined;
  if (!Number.isFinite(stop.offset)) return undefined;
  const at = missingComma(stop.text, stop.offset);
  if (at === undefined) return undefined;
  const item = AN_ITEM.exec(stop.text.slice(at))?.[0].length ?? 1;
  return { title: COMMA_IN_BRACKETS, offset: at, length: item };
}

/** Where the first missing comma is, inside the bracket opened at `open`. */
function missingComma(text: string, open: number): number | undefined {
  const inside = blanked(text.slice(open + 1, reachOf(text, open)));
  const gap = A_BREAK.exec(inside);
  return gap ? open + 1 + gap.index + gap[0].length : undefined;
}

/** How far the bracket opened here reaches, counting the brackets inside it. */
function reachOf(text: string, open: number): number {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    const here = text[at] ?? "";
    if ("([{".includes(here)) depth += 1;
    else if (")]}".includes(here)) depth -= 1;
    if (depth === 0) return at;
  }
  return text.length;
}

/**
 * The same text with every `{ … }` blanked to one long word.
 *
 * A `{` gives the newlines back, so a break inside one is the separator it
 * looks like and not the missing comma. Blanked to the same length rather than
 * cut out, so every offset after it still lines up with the source.
 */
function blanked(inside: string): string {
  let depth = 0;
  let out = "";
  for (const here of inside) {
    if (here === "{") depth += 1;
    out += depth > 0 ? "x" : here;
    if (here === "}") depth -= 1;
  }
  return out;
}

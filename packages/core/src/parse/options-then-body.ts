/**
 * The map after a header, which is always its options and never its body.
 *
 * `ParallelStmt: 'parallel' (opts=MapLit)? body=Block` and `ForEachStmt` are
 * the same shape, and the grammar and the specification agree that a trailing
 * map is options. So `parallel { workers: 4 }` is read as a header with options
 * and no body, and the parser then asks for the very brace the writer believes
 * they already wrote:
 *
 *     VN1002 - Expected an opening brace here, found the end of the line.
 *
 * That is the one message in the whole language that names a separator as
 * something it found, and it still says nothing about what happened. The rule
 * is meant; the sentence was the accident.
 */

import type { Explained, ParserStop } from "./explained.types.js";
import { leadKeywordIn, ruleWritten, takesOptionsThenBody } from "./grammar-shape.js";
import { expectedNames } from "./said-error.js";
import { optionsThenBody } from "./separator-words.js";

/** What the parser asks for when it wants a body and the options took the brace. */
const OPENING_BRACE = "{";

/** The rule a body is: entered, with nothing left to open it with. */
const A_BODY = "Block";

/**
 * A title in the language's own words, when this is that error.
 *
 * @param stop Where the parser gave up, and what it was inside when it did.
 * @returns The line to print and the brace to point it at, or nothing when the
 * construct the parser is in does not take a trailing map as its options.
 */
export function optionsAteTheBody(stop: ParserStop): Explained | undefined {
  if (expectedNames(stop.message)[0] !== OPENING_BRACE) return undefined;
  const header = headerAbove(stop.ruleStack);
  if (header === undefined) return undefined;
  const opened = optionsBefore(stop);
  if (opened === undefined) return undefined;
  return { title: optionsThenBody(header), offset: opened, length: 1 };
}

/**
 * The word the construct opens with, when it is one that takes options.
 *
 * The stack reads `... ParallelStmt Block`, because the `Block` the parser has
 * entered is the body and the rule above it is what wanted one. Both the shape
 * and the word are read out of the grammar, so a header that grows an options
 * map later is covered without anybody remembering to come back here.
 */
function headerAbove(stack: readonly string[]): string | undefined {
  if (ruleWritten(stack.at(-1) ?? "") !== A_BODY) return undefined;
  const rule = stack.at(-2) ?? "";
  return takesOptionsThenBody(rule) ? leadKeywordIn(rule) : undefined;
}

/**
 * Where the map that was read as options begins.
 *
 * Read back from where the parser stopped: the token before it has to be the
 * `}` that closed the map, and the `{` that opened it is the brace a reader
 * believed was the body.
 */
function optionsBefore(stop: ParserStop): number | undefined {
  const upTo = Number.isFinite(stop.offset) ? stop.offset : stop.text.length;
  const before = stop.text.slice(0, upTo).replace(/\s+$/, "");
  if (!before.endsWith("}")) return undefined;
  let depth = 0;
  for (let at = before.length - 1; at >= 0; at -= 1) {
    if (before[at] === "}") depth += 1;
    else if (before[at] === "{") depth -= 1;
    if (depth === 0) return at;
  }
  return undefined;
}

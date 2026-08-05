/**
 * The separator nobody wrote, named at last.
 *
 * A `Block` is `'{' NL* (stmts (NL+ stmts)* NL*)? '}'`, so leaving the newline
 * out between two statements fails as a plain `CONSUME('}')`, whose expected
 * set has exactly one member. Twenty-odd different mistakes therefore read the
 * same sentence, `Expected a closing brace here, found ...`, and it points at a
 * brace the writer got right. The word for what was actually wanted has been in
 * `token-words.ts` from the start and no message has ever reached it.
 *
 * The list this is about is read out of the grammar rather than listed here.
 * Which token may begin a statement, and whether a comma is a separator as well
 * as a newline, are both written in `venn.langium`, and a keyword added to the
 * language reaches this the moment `generated/` is rebuilt.
 */

import type { Explained, ParserStop } from "./explained.types.js";
import { COMMA, NEWLINE, separatedListIn } from "./grammar-shape.js";
import { expectedNames } from "./said-error.js";
import { ITEMS_SEPARATED, STATEMENTS_SEPARATED } from "./separator-words.js";

/** What closes a list the grammar gave no closing keyword: the file itself. */
const END = "EOF";

/**
 * A title in the language's own words, when this is that error.
 *
 * @param stop Where the parser gave up, and what it was inside when it did.
 * @returns The line to print and the gap to point it at, or nothing when the
 * rule the parser was in has no list a separator could be missing from, or when
 * the gap already holds one.
 */
export function missingSeparator(stop: ParserStop): Explained | undefined {
  if (!Number.isFinite(stop.offset)) return undefined;
  const list = separatedListIn(stop.ruleStack.at(-1) ?? "");
  if (!list?.separators.has(NEWLINE) || !list.starts.has(stop.tokenType)) return undefined;
  if (!ranOut({ message: stop.message, ending: list.closer ?? END })) return undefined;
  const written = stop.text.slice(0, stop.offset).replace(/\s+$/, "").length;
  if (separated(stop.text.slice(written, stop.offset))) return undefined;
  return {
    title: list.separators.has(COMMA) ? ITEMS_SEPARATED : STATEMENTS_SEPARATED,
    offset: written,
    length: Math.max(stop.offset - written, 1),
  };
}

/**
 * Whether the gap between the two statements already separates them.
 *
 * The sentence would otherwise be printed at a newline the reader wrote, and a
 * reader who takes it gets the same pair of errors one column along. What the
 * parser refused there is a statement the rule does not admit, which is a
 * different mistake with a different answer, and advice that leaves an error it
 * created is worse than the parser's own line.
 */
function separated(gap: string): boolean {
  return /[\n;]/.test(gap);
}

/**
 * Whether the list itself is what ran out, rather than a part of an item.
 *
 * Two shapes, and both are the one mistake. The parser asks for the token that
 * closes the list when the items ran into it, and asks for nothing nameable
 * when it wanted the separator itself. What this rules out is the construct
 * still waiting for a part of its own: `flow "x" constructor` asks for a `{`,
 * and that is a flow with no body, not two declarations run together.
 */
function ranOut(args: { message: string; ending: string }): boolean {
  const expected = expectedNames(args.message);
  if (expected.length === 0) return true;
  return expected.length === 1 && expected[0] === args.ending;
}

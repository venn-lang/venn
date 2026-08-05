import { DefaultLexer, type LexerResult, type TokenizeOptions } from "langium";
import { BOM } from "./byte-order-mark.js";

/** A single lexed token; NL suppression keys off its token-type name. */
type Token = LexerResult["tokens"][number];

/** One lexing error, in the shape the parse layer reads them back in. */
type LexingError = LexerResult["errors"][number];

/** Brackets a newline may not survive inside: an arg list, a list literal. */
const DROPS_NEWLINES = new Set(["(", "["]);
/** The bracket that gives newlines back: a block, a map, a shape. */
const KEEPS_NEWLINES = new Set(["{"]);
const CLOSERS = new Set([")", "]", "}"]);

/**
 * Makes `NL` (a newline or `;`) significant between statements, but suppresses
 * it inside `( )` and `[ ]` so calls, arg lists and list literals may still
 * span multiple physical lines. Blocks and maps (`{ }`) keep their newlines,
 * including where one is written inside a call: the newline is the only thing
 * that ends a statement, so a block that lost it could hold nothing but its
 * last expression.
 *
 * That suppression is also why an unclosed `(` is worth its own error: with the
 * newlines gone the rest of the file is one statement, and no other mistake in
 * it can be reported.
 */
export class VennLexer extends DefaultLexer {
  override tokenize(text: string, options?: TokenizeOptions): LexerResult {
    const marked = text.startsWith(BOM);
    // Written over rather than cut out, so every offset after it is where it
    // was and each span still points where it pointed. The columns it leaves
    // one place to the right on line one are moved at the Problem boundary, by
    // `shownColumn`, and never here: Langium builds `$cstNode.range` out of
    // these very columns and `$cstNode.offset` out of the offsets, so a token
    // whose column had been shifted gave one CST node a range and an offset
    // that disagreed, and rename rewrote five characters beside the name.
    const result = super.tokenize(marked ? ` ${text.slice(BOM.length)}` : text, options);
    const walked = suppressBracketedNewlines(result.tokens);
    result.tokens = walked.tokens;
    result.errors = [...result.errors, ...walked.unclosed];
    return result;
  }
}

/** What the walk leaves behind: the stream, and the brackets nobody closed. */
interface Walked {
  readonly tokens: Token[];
  readonly unclosed: LexingError[];
}

function suppressBracketedNewlines(tokens: Token[]): Walked {
  const kept: Token[] = [];
  const open: Token[] = [];
  for (const token of tokens) {
    const name = token.tokenType.name;
    if (name === "NL" && DROPS_NEWLINES.has(open.at(-1)?.tokenType.name ?? "")) continue;
    if (DROPS_NEWLINES.has(name) || KEEPS_NEWLINES.has(name)) open.push(token);
    else if (CLOSERS.has(name)) open.pop();
    kept.push(token);
  }
  const swallowed = open.filter((token) => DROPS_NEWLINES.has(token.tokenType.name));
  return { tokens: kept, unclosed: swallowed.map(unclosedError) };
}

/**
 * A bracket nobody closed, reported where it was opened.
 *
 * What is carried is which character it was and where, in the shape the lexer
 * reports anything else it could not read. The words a reader sees are the
 * parse layer's, which is where every sentence about a file is written.
 */
function unclosedError(token: Token): LexingError {
  return {
    offset: token.startOffset,
    length: token.image.length,
    line: token.startLine ?? 1,
    column: token.startColumn ?? 1,
    message: `unclosed bracket: ->${token.image}<- at offset: ${token.startOffset}`,
  };
}

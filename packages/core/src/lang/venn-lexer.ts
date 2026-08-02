import { DefaultLexer, type LexerResult, type TokenizeOptions } from "langium";

/** A single lexed token; NL suppression keys off its token-type name. */
type Token = LexerResult["tokens"][number];

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
 */
export class VennLexer extends DefaultLexer {
  override tokenize(text: string, options?: TokenizeOptions): LexerResult {
    const result = super.tokenize(text, options);
    result.tokens = suppressBracketedNewlines(result.tokens);
    return result;
  }
}

function suppressBracketedNewlines(tokens: Token[]): Token[] {
  const kept: Token[] = [];
  const dropping: boolean[] = [];
  for (const token of tokens) {
    const name = token.tokenType.name;
    if (name === "NL" && dropping.at(-1) === true) continue;
    if (DROPS_NEWLINES.has(name)) dropping.push(true);
    else if (KEEPS_NEWLINES.has(name)) dropping.push(false);
    else if (CLOSERS.has(name)) dropping.pop();
    kept.push(token);
  }
  return kept;
}

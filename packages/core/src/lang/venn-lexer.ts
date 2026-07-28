import { DefaultLexer, type LexerResult, type TokenizeOptions } from "langium";

/** A single lexed token; NL suppression keys off its token-type name. */
type Token = LexerResult["tokens"][number];

/**
 * Makes `NL` (a newline or `;`) significant between statements, but suppresses
 * it inside `( )` and `[ ]` so calls, arg lists and list literals may still
 * span multiple physical lines. Blocks and maps (`{ }`) keep their newlines.
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
  let depth = 0;
  for (const token of tokens) {
    depth = Math.max(0, depth + bracketDelta(token.tokenType.name));
    if (token.tokenType.name === "NL" && depth > 0) continue;
    kept.push(token);
  }
  return kept;
}

function bracketDelta(name: string): number {
  if (name === "(" || name === "[") return 1;
  if (name === ")" || name === "]") return -1;
  return 0;
}

import type { CodeSpec } from "../codes/code.types.js";
import { CODES } from "../codes/index.js";

/** What an explainer answers with: the line to print, and which code it is. */
export interface Explained {
  readonly title: string;
  readonly spec: CodeSpec;
}

/**
 * A word the language used to have, where the grammar has no rule for it.
 *
 * `capture` is still parsed, so it reaches its own check and its own code. A
 * `while` is not: it was removed outright, and a keyword with no rule is a parse
 * error wherever it is written. The parser's own words for that are "Expecting
 * token of type 'EOF' but found `while`", which tells nobody what happened to
 * the word or what to write instead.
 */
const REMOVED: Readonly<Record<string, string>> = {
  while:
    "`while` was removed, `loop` while the condition holds, `repeat` a known number of times, `forEach` over a collection.",
};

/**
 * The removed keyword the parser stopped at, said properly.
 *
 * @param token The image of the token the parser stopped at.
 * @returns The title and the code it belongs to, or nothing when the word is
 * not one the language used to have.
 */
export function removedKeyword(token: string): Explained | undefined {
  const said = REMOVED[token];
  return said ? { title: said, spec: CODES.VN5001_REMOVED_KEYWORD } : undefined;
}

/**
 * A statement the language used to have, wherever it is written.
 *
 * Read off the source rather than off the token the parser stopped at, because
 * the two are rarely the same place: with `while` gone from the grammar the
 * word lexes as a name, the line reads as a call, and the parser gets as far as
 * the first statement inside the block before it fails. What it says then is
 * about a `break`, on a line nobody made a mistake on.
 */

import { buildProblem, CODES } from "../codes/index.js";
import type { Problem, Span } from "../problem/index.js";

/**
 * A word the language dropped, and the sentence that says what to write now.
 *
 * A Map, not an object literal: the word comes out of a source file, so an
 * object answers for `constructor`, `toString` and `__proto__` as well, and
 * `flow "x" constructor` reported the source of `Object` as its title.
 */
const REMOVED = new Map<string, string>([
  [
    "while",
    "`while` was removed, `loop` while the condition holds, `repeat` a known number of times, `forEach` over a collection.",
  ],
]);

/**
 * A line that opens a block with a word: the word, a value, and a `{` on the
 * same line. An operator after the word makes it an assignment or a comparison,
 * where the word is a name somebody bound and no statement was removed.
 */
const OPENS_A_BLOCK = /^([ \t]*)([A-Za-z_]\w*)[ \t]+(?![=<>!+*/%-])[^\n]*\{/;

/**
 * Every removed statement in a source, said properly.
 *
 * @param args The source and the uri to record on each span.
 * @returns One problem per line that opens a block with a word the language no
 * longer has, empty when the file uses none.
 */
export function removedSyntax(args: { text: string; uri: string }): Problem[] {
  const found: Problem[] = [];
  let start = 0;
  for (const [index, text] of args.text.split("\n").entries()) {
    const problem = removedOn({ text, start, number: index + 1 }, args.uri);
    if (problem) found.push(problem);
    start += text.length + 1;
  }
  return found;
}

/** One line of source, where it starts, and which line of the file it is. */
interface Line {
  readonly text: string;
  readonly start: number;
  readonly number: number;
}

/** The problem for one line, pointed at the word itself rather than the line. */
function removedOn(line: Line, uri: string): Problem | undefined {
  const opened = OPENS_A_BLOCK.exec(line.text);
  const word = opened?.[2] ?? "";
  const said = REMOVED.get(word);
  if (!said) return undefined;
  const indent = (opened?.[1] ?? "").length;
  const span: Span = {
    uri,
    offset: line.start + indent,
    length: word.length,
    line: line.number,
    column: indent + 1,
  };
  return buildProblem({ spec: CODES.VN5001_REMOVED_KEYWORD, span, title: said });
}

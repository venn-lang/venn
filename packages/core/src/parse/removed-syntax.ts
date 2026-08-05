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
import { shownColumn } from "../lang/index.js";
import type { Problem, Span } from "../problem/index.js";

/** What a word the language does not have is answered with. */
interface Said {
  readonly title: string;
  readonly help?: string;
}

/**
 * The head of the sentence for a word this language never had.
 *
 * One phrasing, exported, because "this spelling does not exist here" is
 * reached from more than one failure: a block-opening word here, an operator
 * the language has no form of elsewhere. Two copies of it is the mistake this
 * repository has now spent two epics deleting.
 *
 * @param word The word as the reader wrote it.
 * @returns The title, with the way out left to the caller's `help`, because the
 * way out is what differs between the places this is raised from.
 */
export function noSuchSpelling(word: string): string {
  return `Venn has no \`${word}\`.`;
}

/**
 * A word the language dropped, and the sentence that says what to write now.
 *
 * A Map, not an object literal: the word comes out of a source file, so an
 * object answers for `constructor`, `toString` and `__proto__` as well, and
 * `flow "x" constructor` reported the source of `Object` as its title.
 *
 * Every snippet in a `help` was run before it was written down: a diagnostic
 * that teaches a spelling the language does not have is worse than the silence
 * it replaces. `while` alone carries its whole sentence in the title, because
 * that is the sentence it has shipped with and a reader who has already
 * googled it finds the same words.
 */
const REMOVED = new Map<string, Said>([
  [
    "while",
    {
      title:
        "`while` was removed, `loop` while the condition holds, `repeat` a known number of times, `forEach` over a collection.",
    },
  ],
  [
    "for",
    {
      title: noSuchSpelling("for"),
      help: "Write `forEach r in rows { print r }` over a collection, `repeat` a known number of times, or `loop` while a condition holds.",
    },
  ],
  [
    "foreach",
    {
      title: noSuchSpelling("foreach"),
      help: "The word is `forEach`, with a capital E: `forEach r in rows { print r }`.",
    },
  ],
  [
    "each",
    {
      title: noSuchSpelling("each"),
      help: "The word is `forEach`: `forEach r in rows { print r }`.",
    },
  ],
  [
    "until",
    {
      title: noSuchSpelling("until"),
      help: "`loop` runs while a condition holds, so write the condition the other way round: `loop n <= 3 { n = n + 1 }`.",
    },
  ],
  [
    "do",
    {
      title: noSuchSpelling("do"),
      help: "`loop { break }` repeats until a `break`, and `loop n < 3 { n = n + 1 }` while a condition holds.",
    },
  ],
  [
    "switch",
    {
      title: noSuchSpelling("switch"),
      help: 'The word is `match`, and an arm runs statements in a block rather than after a `=>`: `match x { 1 { print "one" }, _ { print "many" } }`.',
    },
  ],
]);

/**
 * A line that opens a block with a word: the word, a value, and a `{` on the
 * same line. An operator after the word makes it an assignment or a comparison,
 * where the word is a name somebody bound and no statement was removed.
 *
 * A byte-order mark counts as indentation, so line one of a file that carries
 * one is read like any other line and the word is still found. The column it
 * adds comes back off below.
 */
const OPENS_A_BLOCK = /^([ \t\uFEFF]*)([A-Za-z_]\w*)[ \t]+(?![=<>!+*/%-])[^\n]*\{/;

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
  const said = REMOVED.get(opened?.[2] ?? "");
  if (!opened || !said) return undefined;
  return buildProblem({
    spec: CODES.VN5001_REMOVED_KEYWORD,
    span: spanOf(line, uri, opened),
    title: said.title,
    help: said.help,
  });
}

/** Where the word sits, rather than wherever error recovery came to rest. */
function spanOf(line: Line, uri: string, opened: RegExpExecArray): Span {
  const indent = (opened[1] ?? "").length;
  return {
    uri,
    offset: line.start + indent,
    length: (opened[2] ?? "").length,
    line: line.number,
    column: shownColumn({ text: line.text, line: line.number, column: indent + 1 }),
  };
}

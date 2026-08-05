/**
 * A string that ended in the middle of its own `${…}`, because the placeholder
 * held a quote of the kind that closes the string.
 *
 * Read off the source and not off the parser's error, because what the parser
 * makes of the wreckage depends entirely on what follows the mistake: the same
 * `${m["core"]}` is a name nobody bound after `print`, three missing braces in
 * a `step` title, and an unreadable `$` when the placeholder held a string of
 * its own. The string and the placeholder are the same in all three.
 */

import { buildProblem, CODES } from "../codes/index.js";
import { placeholderEnd, unclosedPlaceholder } from "../interpolation/index.js";
import type { Problem } from "../problem/index.js";
import { spanAt } from "./at-an-offset.js";

/**
 * A comment or a string literal, in the order the lexer tries them, so that a
 * `#` inside a string is text and `"""` is one literal rather than two.
 *
 * Sticky rather than global: the walk below anchors it at each delimiter it
 * finds, so a literal nothing closes costs one scan instead of one per quote.
 */
const LITERAL = /#[^\n\r]*|"""[\s\S]*?"""|r"[^"]*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y;

/** A character that opens one of the forms above. */
const OPENS = /[#"']/g;

/** What keeps the `r` of `var"x"` from opening a raw string. */
const WORD = /\w/;

/** A string the quote ended early, and the placeholder that outlived it. */
interface CutShort {
  /** The delimiter that ended the string, which is also what cut the slot. */
  readonly quote: string;
  /** Where that delimiter is, which is where a reader has to look. */
  readonly at: number;
  /** The placeholder as written, `${` to `}`, read straight through the quote. */
  readonly slot: string;
}

/**
 * Every string a quote inside its own `${…}` cut short, said properly.
 *
 * @param args The source and the uri to record on each span.
 * @returns One problem per cut-short string, pointed at the quote that ended
 * it, empty for a file whose every placeholder closes inside its string.
 */
export function quoteInASlot(args: { text: string; uri: string }): Problem[] {
  if (!args.text.includes("${")) return [];
  const found: Problem[] = [];
  for (const match of literalsIn(args.text)) {
    const cut = cutShort({ literal: match.literal, start: match.start, text: args.text });
    if (cut) found.push(problem(cut, args));
  }
  return found;
}

/**
 * Every literal in the file, up to the first one nothing closes.
 *
 * A global regex alone is quadratic on a file whose quotes do not pair: every
 * failed start rescans the tail, so a run of `\"` costs one scan per quote, and
 * a `.vn` file is library input. Here each delimiter is found once and the
 * literal is matched sticky from it, so a literal nothing closes costs one scan
 * and then stops the walk. Everything after such a literal is inside it, and
 * the lexer already refuses the file for it, so there is nothing left to read.
 */
function literalsIn(text: string): { literal: string; start: number }[] {
  const found: { literal: string; start: number }[] = [];
  OPENS.lastIndex = 0;
  for (let opener = OPENS.exec(text); opener; opener = OPENS.exec(text)) {
    const start = opener.index - (rawAt(text, opener) ? 1 : 0);
    LITERAL.lastIndex = start;
    const match = LITERAL.exec(text);
    if (!match) return found;
    found.push({ literal: match[0], start });
    OPENS.lastIndex = start + match[0].length;
  }
  return found;
}

/** Whether this quote is the one a raw string opens with, one character along. */
function rawAt(text: string, opener: RegExpExecArray): boolean {
  if (opener[0] !== '"' || text[opener.index - 1] !== "r") return false;
  return !WORD.test(text[opener.index - 2] ?? "");
}

/** The delimiter that closes this literal, or nothing when it cannot be cut. */
function closerOf(literal: string): string | undefined {
  // A comment holds no placeholder, and a block string cannot be ended by one
  // quote, so neither can suffer this. Both are matched all the same, so that
  // what is inside them is never read again as a string of its own.
  if (literal.startsWith("#") || literal.startsWith('"""')) return undefined;
  return literal.startsWith("'") ? "'" : '"';
}

/** One literal, weighed: is there a `${` in it that the closing quote cut off? */
function cutShort(args: { literal: string; start: number; text: string }): CutShort | undefined {
  const quote = closerOf(args.literal);
  if (quote === undefined) return undefined;
  const lead = args.literal.startsWith("r") ? 2 : 1;
  const at = args.start + args.literal.length - 1;
  const open = unclosedPlaceholder(args.literal.slice(lead, args.literal.length - 1));
  if (open === undefined) return undefined;
  return reaching({ from: args.start + lead + open, at, quote, text: args.text });
}

/**
 * The placeholder read on past the quote that ended the string, when that quote
 * turns out to be the first of a pair written inside it.
 *
 * Two delimiters between the string's end and the placeholder's `}` are the
 * whole signal, and the guard that keeps `{ a: "x ${y" }` out: there the `}`
 * belongs to the map, only one quote stands before it, and the `${` really was
 * meant as text. A newline in between says the same, from the other side.
 */
function reaching(args: {
  from: number;
  at: number;
  quote: string;
  text: string;
}): CutShort | undefined {
  const end = placeholderEnd(args.text, args.from);
  if (end === -1) return undefined;
  const tail = args.text.slice(args.at, end);
  if (tail.includes("\n") || tail.split(args.quote).length < 3) return undefined;
  return { quote: args.quote, at: args.at, slot: args.text.slice(args.from, end + 1) };
}

function problem(cut: CutShort, args: { text: string; uri: string }): Problem {
  return buildProblem({
    spec: CODES.VN1004_STRING_CUT_SHORT,
    span: spanAt({ text: args.text, uri: args.uri, offset: cut.at, length: 1 }),
    title: `The string ends at this \`${cut.quote}\`, in the middle of a \`\${…}\`.`,
    help: helpFor(cut),
  });
}

/**
 * The rule the grammar states above `terminal STRING`, said where it is needed.
 *
 * A regex terminal cannot count nesting, so the restriction is real and stays;
 * what the reader is owed is the spelling that works, in their own placeholder
 * rather than in an example of somebody else's.
 */
function helpFor(cut: CutShort): string {
  const outer = cut.quote === '"' ? "double-quoted" : "single-quoted";
  const inner = cut.quote === '"' ? "single quotes" : "double quotes";
  const written = rewritten(cut);
  const spelling = written === undefined ? "" : `: \`${written}\``;
  return `A \`\${…}\` inside a ${outer} string writes its own strings with ${inner}${spelling}.`;
}

/**
 * The same placeholder with its quotes swapped, when swapping cannot lie.
 *
 * Two ways it can. One already holding the other kind comes back as a string
 * ending early somewhere else, which is the mistake this exists to stop
 * teaching. And an escape of the quote being swapped is part of the value, not
 * punctuation: `${m["a\"b"]}` reads a key of `a"b`, and swapping every quote
 * turns it into `${m['a\'b']}`, which runs perfectly and reads a different key.
 * Running a suggestion proves the spelling exists; it does not prove the
 * spelling still says what the reader said.
 */
function rewritten(cut: CutShort): string | undefined {
  const other = cut.quote === '"' ? "'" : '"';
  if (cut.slot.includes(other) || cut.slot.includes("\\")) return undefined;
  return cut.slot.split(cut.quote).join(other);
}

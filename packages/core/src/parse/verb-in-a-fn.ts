/**
 * A verb written inside a `fn`, which is pure at every depth of its body, and a
 * `try` block written there, which the grammar refuses for a narrower reason:
 * a pure body may hold `try ... else ...`, the expression, but not the block form.
 *
 * A pure body has statements of its own and neither is one of them, so a line
 * that starts with a name is on its way to being an assignment and stops at the
 * argument, and a `try` falls through to the trailing expression a block may end
 * in, and stops inside it. What the parser says then names the token it reached,
 * which is sometimes a keyword recovery landed on rather than the word that was
 * actually refused.
 */
import type { Explained } from "./explained.types.js";
import { KEYWORDS } from "./keywords.js";

/** Everything before the token the parser stopped at, when it is one name. */
const VERB_ALONE = /^[ \t]*([A-Za-z_][\w.]*)[ \t]*$/;

/** What opens a body, so the nearest one above the line says which body this is. */
const OPENS_A_BODY = /^[ \t]*(?:pub[ \t]+)?(fn|fragment|flow|deco|step|group|namespace)\b/;

/** A `try` block, whose statement form a `fn` cannot hold. */
const OPENS_A_TRY = /^[ \t]*try\b/;

/** A line that closes a block, whatever else it goes on to do. */
const CLOSES = /^[ \t]*}/;

/** What a `try` inside a `fn` is told as, wherever recovery happened to land. */
const TRY_TITLE =
  "A `fn` is pure, so it cannot hold a `try` block. Write `try ... else ...`, the expression, instead.";

/**
 * A title in the language's own words, when this is that error.
 *
 * @param args The source and where in it the parser stopped.
 * @returns The title to report, and where to point it, or nothing when the
 * line is not a verb or a `try` written inside a `fn`, which is the only shape
 * this can explain.
 */
export function verbInAFn(args: { text: string; offset: number }): Explained | undefined {
  const start = args.text.lastIndexOf("\n", args.offset) + 1;
  const end = args.text.indexOf("\n", args.offset);
  if (emptyLine(args.text, args.offset, end)) return undefined;
  const found = enclosing(args.text.slice(0, start));
  if (found.owner !== "fn") return undefined;
  const tryOffset = tryAt({ text: args.text, start, offset: args.offset }) ?? found.tryOffset;
  if (tryOffset !== undefined) return { title: TRY_TITLE, offset: tryOffset };
  const called = args.text.slice(start, args.offset).match(VERB_ALONE)?.[1];
  return called && !KEYWORDS.has(called) ? { title: pureBodyCannotCall(called) } : undefined;
}

/**
 * With nothing after the token the line is no statement at all, and reading it
 * as one would explain a mistake nobody made.
 */
function emptyLine(text: string, offset: number, end: number): boolean {
  return text.slice(offset, end === -1 ? undefined : end).trim() === "";
}

/**
 * Why a `fn` cannot call this, in the one sentence the language uses for it.
 *
 * Said here and by the checker, because the grammar catches only the spellings
 * it fails to parse: `io.print "x"` is refused as a parse error and
 * `let a = io.print "x"` parses cleanly, and the two are the same mistake.
 *
 * @param called The dotted name being called.
 * @returns The title, ready to be the whole of a Problem's first line.
 */
export function pureBodyCannotCall(called: string): string {
  return `A \`fn\` is pure, so it cannot call \`${called}\`. A verb belongs in a \`fragment\`, or at the top level of a file.`;
}

/**
 * Whether the token the parser stopped at is a bare `try`: nothing before it on
 * the line, and the word itself right where recovery landed.
 */
function tryAt(args: { text: string; start: number; offset: number }): number | undefined {
  const before = args.text.slice(args.start, args.offset);
  if (before.trim() !== "") return undefined;
  return /^try\b/.test(args.text.slice(args.offset)) ? args.offset : undefined;
}

/** What the block above a line belongs to, and the `try` passed over on the way
 * there, when the parser fell through one of those instead of stopping at it. */
interface Enclosing {
  readonly owner?: string;
  readonly tryOffset?: number;
}

/**
 * Which body a line sits in, read upward by counting the blocks that closed on
 * the way, so a `fn` whose `}` is already behind the line is not taken for the
 * body it sits in. A block that opens no body of its own, an `if` or a `try`
 * written over several lines, is passed over, and a `try` passed over this way
 * is remembered, since it is the statement a `fn`'s body actually refused.
 */
function enclosing(above: string): Enclosing {
  let closed = 0;
  let tryOffset: number | undefined;
  for (const written of linesAbove(above).reverse()) {
    const line = written.text.trimEnd();
    const brace = braceOf(line);
    if (brace === "shuts") closed += 1;
    else if (brace !== "opens") continue;
    else if (closed > 0) closed -= 1;
    else if (OPENS_A_BODY.test(line)) return { owner: line.match(OPENS_A_BODY)?.[1], tryOffset };
    else tryOffset ??= tryKeywordOffset(line, written.offset);
  }
  return { tryOffset };
}

/** The line's own `try`, at its absolute offset in the source, when it opens one. */
function tryKeywordOffset(line: string, offset: number): number | undefined {
  return OPENS_A_TRY.test(line) ? offset + line.indexOf("try") : undefined;
}

/** One line of source, paired with the offset it starts at. */
interface AboveLine {
  readonly text: string;
  readonly offset: number;
}

/**
 * Every line above the current one, each paired with where it starts, so a
 * `try` found while walking upward can be pointed at directly.
 */
function linesAbove(above: string): AboveLine[] {
  const withOffsets: AboveLine[] = [];
  let offset = 0;
  for (const text of above.split("\n")) {
    withOffsets.push({ text, offset });
    offset += text.length + 1;
  }
  return withOffsets;
}

/** What a line does to the nesting: `} else {` does both, so it does neither. */
function braceOf(line: string): "opens" | "shuts" | "neither" {
  const opens = line.endsWith("{");
  const shuts = CLOSES.test(line);
  if (opens === shuts) return "neither";
  return opens ? "opens" : "shuts";
}

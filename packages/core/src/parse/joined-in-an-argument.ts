/**
 * `print "a" + "b"`, where the suggestion used to be a program the compiler
 * then refused.
 *
 * An argument is one value, so the parser stops at the `+` and the recovery
 * offered `print ("a" + "b")`. Bracketing it is correct about the argument and
 * beside the point about the line: the brackets made it parse, and then the
 * type check refused it, twice, without ever saying the word interpolation.
 *
 * So where a `+` in an argument is joining text, this says the same thing the
 * type check says about `print ("a" + "b")`, out of the same module, and the
 * bracket advice is not offered at all.
 */

import { buildProblem, CODES } from "../codes/index.js";
import { JOINED_WITH_PLUS, joinInstead, type Problem } from "../problem/index.js";
import { lineStart, spanAt } from "./at-an-offset.js";

/** What can be called: a name, or a dotted one such as `io.print`. */
const CALLED = /^[A-Za-z_][\w.]*$/;

/** Long enough to be unreadable as a suggestion, and probably not one line. */
const TOO_LONG = 60;

/**
 * Every argument that is joining strings with `+`, where the parser tripped.
 *
 * @param args The source, the uri to record on each span, and the offsets the
 * parser stopped at, so a line it read happily is never given a new error.
 * @returns One problem per such line, empty when the file has none.
 */
export function joinedInAnArgument(args: {
  text: string;
  uri: string;
  stopped: ReadonlySet<number>;
}): Problem[] {
  // Keyed by line, because the parser stops at every `+` of a chain and the
  // answer is about the whole argument rather than about one operator in it.
  const found = new Map<number, Problem>();
  for (const offset of [...args.stopped].sort((a, b) => a - b)) {
    const start = lineStart(args.text, offset);
    const problem = found.has(start) ? undefined : joinAt(offset, start, args);
    if (problem) found.set(start, problem);
  }
  return [...found.values()];
}

/** The problem for one stopping place, or nothing when this is some other error. */
function joinAt(
  offset: number,
  start: number,
  args: { text: string; uri: string },
): Problem | undefined {
  if (args.text[offset] !== "+" || args.text[offset + 1] === "+") return undefined;
  const operands = argumentPieces(args.text, offset, start);
  if (!operands) return undefined;
  return buildProblem({
    spec: CODES.VN3024_JOINED_WITH_PLUS,
    span: spanAt({ text: args.text, uri: args.uri, offset, length: 1 }),
    title: JOINED_WITH_PLUS,
    help: joinInstead(operands),
  });
}

/**
 * The pieces of the argument, when the argument is a `+` chain with text in it.
 *
 * The whole argument rather than the two operands beside the `+`, because
 * `print "a: " + a + " b: " + b` is one string being built and the answer names
 * all of it.
 */
function argumentPieces(text: string, offset: number, start: number): string[] | undefined {
  const end = text.indexOf("\n", offset);
  const line = text.slice(start, end === -1 ? undefined : end);
  if (line.trim().length > TOO_LONG || /[{}#]/.test(line)) return undefined;
  const at = line.indexOf(" ");
  if (at <= 0 || !CALLED.test(line.slice(0, at))) return undefined;
  const pieces = splitOnPlus(line.slice(at).trim());
  return pieces?.some(isText) ? pieces : undefined;
}

/** Whether a piece is a written-out string, which is what makes this a join. */
function isText(piece: string): boolean {
  return piece.startsWith('"') || piece.startsWith("'");
}

/**
 * The argument split at every `+` that is one.
 *
 * A `+` inside a string or inside brackets belongs to what encloses it, and a
 * `+` with nothing before it is a sign rather than an operator, so a chain that
 * yields an empty piece is not one of these and is left to the parser.
 */
function splitOnPlus(argument: string): string[] | undefined {
  const cuts = operatorsIn(argument);
  const pieces = [...cuts, argument.length].map((to, index) => {
    const from = index === 0 ? 0 : (cuts[index - 1] as number) + 1;
    return argument.slice(from, to).trim();
  });
  return pieces.length > 1 && pieces.every((piece) => piece !== "") ? pieces : undefined;
}

/** Where a `+` is an operator: outside every string and outside every bracket. */
function operatorsIn(argument: string): number[] {
  const at: number[] = [];
  let depth = 0;
  let quote = "";
  for (const [index, char] of [...argument].entries()) {
    if (quote) quote = char === quote ? "" : quote;
    else if (char === '"' || char === "'") quote = char;
    else if ("([".includes(char)) depth += 1;
    else if (")]".includes(char)) depth -= 1;
    else if (char === "+" && depth === 0) at.push(index);
  }
  return at;
}

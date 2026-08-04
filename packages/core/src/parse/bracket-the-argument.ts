/**
 * The one syntax error worth explaining rather than reporting.
 *
 * An argument is one value and its accesses: `x`, `x.y`, `x[0]`, `f(1)`. An
 * operator is not part of it, so `print 300ms + 1s` stops at the `+`.
 *
 * That is the same rule Haskell, Elm, OCaml and F# use, and for the same reason:
 * arguments are separated by spaces, so `print a b` is two of them, and a
 * grammar cannot also read `print a - b` as one. What those languages get right
 * is the message, which is what this is.
 */

import { CUTS_A_VALUE, KEYWORDS } from "./keywords.js";

/** Operators that cannot begin a value, so the reading is never in doubt. */
const JOINING = new Set([
  "+",
  "*",
  "/",
  "%",
  "==",
  "!=",
  "~=",
  "<",
  ">",
  "<=",
  ">=",
  "&&",
  "||",
  "??",
  "in",
]);

/**
 * `-` also negates, and there the two readings are told apart by how it was
 * written: `a -1` is two arguments, `a - 1` and `a-1` are the subtraction. The
 * grammar takes the negation, so a `-` only reaches this when it was spaced like
 * an operator, and then the advice below is the right one.
 */
const NEGATES = "-";

/** Long enough to be unreadable as a suggestion, and probably not one line. */
const TOO_LONG = 60;

/** What can be called: a name, or a dotted one such as `http.get`. */
const CALLED = /^[A-Za-z_][\w.]*$/;

/** A bare word in the operand, which may be where the argument has to stop. */
const A_WORD = /[A-Za-z_]\w*/g;

const RULE = "An argument is one value, so";

/**
 * A title in the language's own words, when this is that error.
 *
 * @param args The operator the parser stopped at, the source, and where in it.
 * @returns The title to report, or nothing when this is some other error and the
 * parser's own message is the better one.
 */
export function bracketTheArgument(args: {
  operator: string;
  text: string;
  offset: number;
}): string | undefined {
  const { operator } = args;
  if (operator !== NEGATES && !JOINING.has(operator)) return undefined;
  if (!calls(args)) return undefined;
  const lead = `${RULE} \`${operator}\` has to be bracketed.`;
  const parts = readLine(args);
  if (!parts) return `${lead} Put brackets around the whole argument.`;
  return `${lead} ${advice({ parts, operator })}`;
}

/**
 * Whether there is a call in front of the operator at all.
 *
 * A bracket goes around the argument of something being called, and a statement
 * keyword is not that: `let in = 1` was answered with "write `let (in= 1)`",
 * which is neither a call nor a line that parses. The word is read from the
 * last `{` on the line rather than from its start, so a statement written
 * inside a block is still judged on its own words.
 */
function calls(args: { text: string; offset: number }): boolean {
  const start = args.text.lastIndexOf("\n", args.offset) + 1;
  const opened = args.text.lastIndexOf("{", args.offset);
  const from = Math.max(start, opened + 1);
  const called = args.text.slice(from, args.offset).trim().split(/[\s(]/)[0] ?? "";
  return !KEYWORDS.has(called);
}

/** What the line is made of, or nothing when no suggestion can be trusted. */
interface Parts {
  /** What is being called: the first word on the line. */
  called: string;
  /** Everything between it and the operator, which may be empty. */
  before: string;
  /** What comes after the operator. */
  operand: string;
}

/**
 * What to write instead.
 *
 * With nothing before the operator it is negating, and there is one reading. A
 * `-` with something before it is either a subtraction or a negative argument,
 * and guessing would silently pick one, so both are offered.
 */
function advice(args: { parts: Parts; operator: string }): string {
  const { called, before, operand } = args.parts;
  const inside =
    before === "" ? `${args.operator}${operand}` : `${before} ${args.operator} ${operand}`;
  return `Write \`${called} (${inside})\`.`;
}

/**
 * The line split at the operator.
 *
 * Left out entirely when the line is long, carries a block, or has nothing
 * callable at the front, since a suggestion that does not quite work is worse
 * than none.
 */
function readLine(args: { text: string; offset: number; operator: string }): Parts | undefined {
  const start = args.text.lastIndexOf("\n", args.offset) + 1;
  const end = args.text.indexOf("\n", args.offset);
  const line = args.text.slice(start, end === -1 ? undefined : end);
  if (line.trim().length > TOO_LONG || /[{}#]/.test(line)) return undefined;
  const at = line.indexOf(" ");
  const called = at > 0 ? line.slice(0, at) : "";
  if (!CALLED.test(called)) return undefined;
  const cut = args.offset - start;
  const before = line.slice(at, cut).trim();
  const operand = upToAClause(line.slice(cut + args.operator.length).trim());
  return usable({ called, before, operand }, args.operator);
}

/**
 * The operand, stopped where the next clause begins.
 *
 * `import a + b from "x"` was read as a call taking the whole rest of the line,
 * `from` clause and all, and that was offered back as the line to write.
 */
function upToAClause(operand: string): string {
  for (const word of operand.matchAll(A_WORD)) {
    const joined = operand[word.index - 1] === ".";
    if (!joined && CUTS_A_VALUE.has(word[0])) return operand.slice(0, word.index).trim();
  }
  return operand;
}

/**
 * The parts, when a line built from them would read as the one somebody meant.
 *
 * Nothing before the operator leaves nothing to join it to, unless the operator
 * is the `-` that negates, which is a value on its own.
 */
function usable(parts: Parts, operator: string): Parts | undefined {
  if (parts.operand === "" || (parts.before === "" && operator !== NEGATES)) return undefined;
  return parts;
}

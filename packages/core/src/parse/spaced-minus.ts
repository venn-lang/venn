/**
 * The `-` that was meant to subtract, in a place where a value goes.
 *
 * A bare argument may now begin with `-`, which is the only way to write a
 * negative one. That makes `print total - 1` parse as two arguments, and it is
 * almost certainly one subtraction nobody bracketed. The two are told apart the
 * way Swift tells them apart: `-1` tight against the value negates, `- 1` with
 * air on both sides is an operator, and an operator is not part of an argument.
 *
 * A pattern spells a negative number the same way, and the grammar cannot see
 * the difference: `SignedNumber` is a data type rule, so it joins the images of
 * the tokens it matched and the whitespace between them disappears. `- 1` and
 * `-1` both arrive as `"-1"`, and only the source says which was written.
 */

import { buildProblem, CODES } from "../codes/index.js";
import type { Document } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { shownColumn } from "../lang/index.js";
import type { Problem, Span } from "../problem/index.js";
import { bracketTheArgument } from "./bracket-the-argument.js";

/** Where a node sits in the source, which is what says how it was written. */
interface Placed {
  offset: number;
  end: number;
  range?: { start: { line: number; character: number } };
}

/**
 * Report every `-` written apart from what follows it, with the words the
 * parser used to.
 *
 * @param args The parsed document and the source it came from.
 * @returns One problem per loose `-`, empty when every one of them holds
 * together with the value it belongs to.
 */
export function spacedMinus(args: { ast: Document; text: string; uri: string }): Problem[] {
  return [...looseArgs(args), ...loosePatterns(args)];
}

/** Every argument written as `- x`, with the words the parser used to. */
function* looseArgs(args: { ast: Document; text: string; uri: string }): Generator<Problem> {
  for (const node of bareArgs(args.ast)) {
    const loose = looseMinus(node, args.text);
    if (loose) yield problem({ ...args, at: loose });
  }
}

/** A `-`, then air on the same line, then the number it was written apart from. */
const SPACED = /^-[ \t]+[0-9]/;

/** Every pattern written as `- 1`, which the same rule refuses for the same reason. */
function* loosePatterns(args: { ast: Document; text: string; uri: string }): Generator<Problem> {
  for (const node of walk(args.ast)) {
    if (!ast.isNumberLit(node) || !node.raw.startsWith(MINUS)) continue;
    const at = placed(node);
    // Read from the source, because the AST cannot tell the two apart: a data
    // type rule joins the images it matched and the air between them is gone.
    // A newline is a token of its own, so a `-` with its number on the next line
    // is a parse error the parser has already reported.
    if (!at || !SPACED.test(args.text.slice(at.offset, at.end))) continue;
    const span = minusSpan({ ...args, at });
    yield buildProblem({ spec: CODES.VN1002_PARSE, span, title: TIGHT });
  }
}

/** Every argument written without brackets, wherever the language takes one. */
function* bareArgs(document: Document): Generator<ast.Unary> {
  for (const node of walk(document)) {
    const args = ast.isActionCall(node) || ast.isMatcherClause(node) ? node.args : [];
    for (const arg of args) if (ast.isUnary(arg) && arg.operator === MINUS) yield arg;
  }
}

/** Every node of the tree, since an argument may sit at any depth. */
function* walk(node: object): Generator<object> {
  yield node;
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === "object") yield* walk(child);
    }
  }
}

/**
 * Where the `-` is, when it was not written as a negation.
 *
 * Air before it and none after: `total -1` negates. Anything else, `total - 1`
 * and `total-1` alike, is the operator between two values, and an argument is
 * one value.
 */
function looseMinus(node: ast.Unary, text: string): Placed | undefined {
  const whole = placed(node);
  const operand = placed(node.operand);
  if (!whole || !operand) return undefined;
  const before = text[whole.offset - 1] ?? " ";
  const negates = operand.offset === whole.offset + 1 && /\s/.test(before);
  return negates ? undefined : whole;
}

function placed(node: unknown): Placed | undefined {
  return (node as { $cstNode?: Placed }).$cstNode;
}

function problem(args: { at: Placed; text: string; uri: string }): Problem {
  const title = bracketTheArgument({ operator: MINUS, text: args.text, offset: args.at.offset });
  const span = minusSpan(args);
  return buildProblem({ spec: CODES.VN1002_PARSE, span, title: title ?? UNBRACKETED });
}

/**
 * The `-` itself: one character, wherever the node it opens happens to end.
 *
 * Not `spanOf`, which is the span of a node and would squiggle the whole of
 * `- 1` when the mistake is the one character before the space. This runs
 * before the AST exists as anything but a recovery tree, so there is a CST node
 * to read and nothing else.
 */
function minusSpan(args: { at: Placed; text: string; uri: string }): Span {
  const line = (args.at.range?.start.line ?? 0) + 1;
  const column = (args.at.range?.start.character ?? 0) + 1;
  return {
    uri: args.uri,
    offset: args.at.offset,
    length: 1,
    line,
    column: shownColumn({ text: args.text, line, column }),
  };
}

/** The operator this is about, which is also how a negative number begins. */
const MINUS = "-";

const UNBRACKETED = "An argument is one value, so `-` has to be bracketed.";

/** What a pattern is told, where there is no operator to bracket and nothing to
 * subtract from: the only thing `- 1` can have meant there is `-1`. */
const TIGHT = "A negative number is written `-1`, with no space after the `-`.";

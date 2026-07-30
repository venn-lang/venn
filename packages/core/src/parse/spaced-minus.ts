/**
 * The `-` that was meant to subtract, in a place where a value goes.
 *
 * A bare argument may now begin with `-`, which is the only way to write a
 * negative one. That makes `print total - 1` parse as two arguments, and it is
 * almost certainly one subtraction nobody bracketed. The two are told apart the
 * way Swift tells them apart: `-1` tight against the value negates, `- 1` with
 * air on both sides is an operator, and an operator is not part of an argument.
 */

import { buildProblem, CODES } from "../codes/index.js";
import type { Document } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import type { Problem, Span } from "../problem/index.js";
import { bracketTheArgument } from "./bracket-the-argument.js";

/** Where a node sits in the source, which is what says how it was written. */
interface Placed {
  offset: number;
  end: number;
  range?: { start: { line: number; character: number } };
}

/**
 * Report every argument written as `- x`, with the words the parser used to.
 *
 * @param args The parsed document and the source it came from.
 * @returns One problem per loose `-`, empty when every argument holds together.
 */
export function spacedMinus(args: { ast: Document; text: string; uri: string }): Problem[] {
  const found: Problem[] = [];
  for (const node of bareArgs(args.ast)) {
    const loose = looseMinus(node, args.text);
    if (loose) found.push(problem({ ...args, at: loose }));
  }
  return found;
}

/** Every argument written without brackets, wherever the language takes one. */
function* bareArgs(document: Document): Generator<ast.Unary> {
  for (const node of walk(document)) {
    const args = ast.isActionCall(node) || ast.isMatcherClause(node) ? node.args : [];
    for (const arg of args) if (ast.isUnary(arg) && arg.operator === "-") yield arg;
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
  const span: Span = {
    uri: args.uri,
    offset: args.at.offset,
    length: 1,
    line: (args.at.range?.start.line ?? 0) + 1,
    column: (args.at.range?.start.character ?? 0) + 1,
  };
  const title = bracketTheArgument({ operator: "-", text: args.text, offset: args.at.offset });
  return buildProblem({ spec: CODES.VN1002_PARSE, span, title: title ?? UNBRACKETED });
}

const UNBRACKETED = "An argument is one value, so `-` has to be bracketed.";

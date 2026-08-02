import {
  type AstNode,
  buildProblem,
  CODES,
  type Document,
  type ExpectStmt,
  isActionCall,
  isAnnotation,
  isExpectStmt,
  isNamedType,
  isRef,
  isRunStmt,
  isStringLit,
  isValueImport,
  type Problem,
  parseExpression,
  type StringLit,
  scanInterpolations,
  type ValueImport,
  walkAst,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * A name a file brought in and never read.
 *
 * A hint rather than an error: it is untidy, not wrong, and a check that fails
 * on it is a check people stop running. What it is worth is the reading of the
 * file, where the top says what the file needs and one of them is a leftover.
 */
export function checkUnusedImport(document: Document, ctx: CheckContext): Problem[] {
  const read = namesRead(document);
  const problems: Problem[] = [];
  for (const decl of document.imports) {
    // `pub import` hands the name on to whoever imports this file, which is
    // what the name is for. Reading it here as well would be beside the point.
    if (isValueImport(decl) && !decl.export) problems.push(...unread(decl, read, ctx));
  }
  return problems;
}

function unread(decl: ValueImport, read: ReadonlySet<string>, ctx: CheckContext): Problem[] {
  // A whole namespace under one name, or a default: what it holds is reached
  // through the name, so the name being read is the whole question.
  const single = decl.wildcard ?? decl.default;
  if (single) return read.has(single) ? [] : [saidNothing(single, decl, ctx)];
  return decl.names
    .map((one) => one.alias ?? one.name)
    .filter((name) => !read.has(name))
    .map((name) => saidNothing(name, decl, ctx));
}

function saidNothing(name: string, decl: ValueImport, ctx: CheckContext): Problem {
  return {
    ...buildProblem({
      spec: CODES.VN5005_UNUSED_IMPORT,
      span: nodeSpan(decl, ctx.uri),
      title: `"${name}" is imported and never used.`,
    }),
    help: "Take it out of the import, or use it.",
  };
}

/**
 * Every name the file reads.
 *
 * A `Ref` anywhere covers a value, a namespace before its verb and a function
 * being called, because all three are written as a name. Three more do not
 * appear as one: a type in an annotation, a matcher after `expect`, and
 * anything inside a `${…}`, whose expression is parsed on its own and hangs off
 * no tree this walk reaches.
 */
function namesRead(document: Document): ReadonlySet<string> {
  const found = new Set<string>();
  for (const node of walkAst(document)) named(node, found);
  return found;
}

function named(node: AstNode, into: Set<string>): void {
  if (isRef(node)) into.add(node.name);
  else if (isExpectStmt(node)) namedMatcher(node, into);
  else if (isStringLit(node)) namesInside(node, into);
  // Three more are written as a word rather than as a reference: the verb of a
  // namespace (`json.parse "x"`, whose target is one dotted name), the fragment
  // a `run` names, and the decorator an `@` names.
  else if (isActionCall(node)) into.add(headOf(node.target));
  else if (isRunStmt(node)) into.add(headOf(node.target));
  else if (isAnnotation(node)) into.add(node.name);
  else namedInType(node, into);
}

/** `shop.checkout` reads `shop`, and `checkout` reads `checkout`. */
function headOf(target: string): string {
  return target.split(".")[0] as string;
}

/** `expect total closeTo 9.99` reads `closeTo`, which is written as a word. */
function namedMatcher(node: ExpectStmt, into: Set<string>): void {
  if (node.matcher) into.add(node.matcher.name);
}

/**
 * The names inside a string's placeholders.
 *
 * `"${withTax(order.total)}"` is a call to an imported function, and the whole
 * of it lives inside a string literal until somebody parses it.
 */
function namesInside(node: StringLit, into: Set<string>): void {
  const cst = node.$cstNode;
  if (!cst) return;
  for (const slot of scanInterpolations(cst.text)) {
    const parsed = parseExpression(slot.source);
    if (!parsed) continue;
    // The walk gives what is inside a node, not the node: `${pi}` is a whole
    // expression that is one reference, and it has nothing inside it.
    named(parsed, into);
    for (const inner of walkAst(parsed)) named(inner, into);
  }
}

/**
 * A name written where a type goes, which is a use like any other.
 *
 * Qualified at the head: `http.Request` is the `http` that was imported, so what
 * counts as read is the first part.
 */
function namedInType(node: AstNode, into: Set<string>): void {
  if (!isNamedType(node)) return;
  const head = node.name.split(".")[0];
  if (head) into.add(head);
}

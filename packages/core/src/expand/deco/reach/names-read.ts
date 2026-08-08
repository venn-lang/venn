import type { AstNode } from "langium";
import { callArgs, insideAnnotation, walkAst } from "../../../ast/index.js";
import type {
  ActionCall,
  Block,
  Expr,
  IfStmt,
  LetStmt,
  Statement,
} from "../../../generated/ast.js";
import {
  isActionCall,
  isBlock,
  isFnExpr,
  isIfStmt,
  isLetStmt,
  isRef,
  isStringLit,
} from "../../../generated/ast.js";
import { spanOf } from "../../../span/index.js";
import type { NameRead } from "./reach.types.js";
import { slotReads } from "./slot-reads.js";

/**
 * Every name a `deco` body reads, with where it reads it.
 *
 * Only what the body would actually evaluate. A statement it refuses outright,
 * a binding that calls an action or anything it has no way to run, is one
 * problem already, and naming the words inside it would be a second sentence
 * about the same line.
 *
 * @param args The body and the file it was written in.
 * @returns One read per name written, in the order the body writes them.
 */
export function namesRead(args: { body: Block; uri: string }): NameRead[] {
  return args.body.stmts.flatMap((stmt) => inStmt(stmt, args.uri));
}

function inStmt(stmt: Statement, uri: string): NameRead[] {
  if (isLetStmt(stmt)) return inLet(stmt, uri);
  if (isActionCall(stmt)) return inCall(stmt, uri);
  return isIfStmt(stmt) ? inIf(stmt, uri) : [];
}

/** Trailing arguments make it an action, which the body refuses before reading it. */
function inLet(stmt: LetStmt, uri: string): NameRead[] {
  if (stmt.args.length > 0 || stmt.opts) return [];
  return inExpr(stmt.value, uri);
}

/** The head is a dotted name rather than an expression; the arguments are not. */
function inCall(stmt: ActionCall, uri: string): NameRead[] {
  const given: Expr[] = [...callArgs(stmt), ...(stmt.opts ? [stmt.opts] : [])];
  return given.flatMap((one) => inExpr(one, uri));
}

function inIf(stmt: IfStmt, uri: string): NameRead[] {
  const otherwise = stmt.otherwise;
  const rest = otherwise && isBlock(otherwise) ? otherwise.stmts : [otherwise];
  return [
    ...inExpr(stmt.cond, uri),
    ...stmt.then.stmts.flatMap((one) => inStmt(one, uri)),
    ...rest.flatMap((one) => (one ? inStmt(one as Statement, uri) : [])),
  ];
}

function inExpr(expr: Expr, uri: string): NameRead[] {
  return [expr as AstNode, ...walkAst(expr)].flatMap((node) => atNode(node, uri));
}

function atNode(node: AstNode, uri: string): NameRead[] {
  if (insideAHook(node)) return [];
  if (isStringLit(node)) return slotReads(node, uri);
  if (!isRef(node) || insideAnnotation(node)) return [];
  return [{ name: node.name, span: spanOf(node, uri) }];
}

/**
 * Whether this read sits inside a hook rather than in the body around it.
 *
 * A hook is a value the body hands over: `target.wrap(fn (call, args) { … })`
 * runs once the program is running, not while it is being written. So a name it
 * reads may be one the program binds, and refusing it here reported the wrong
 * moment. What the body itself reads is still refused, and a name a hook reads
 * that nothing binds anywhere is the document's ordinary business.
 */
function insideAHook(node: AstNode): boolean {
  for (let at: AstNode | undefined = node; at; at = at.$container) {
    if (isFnExpr(at)) return true;
  }
  return false;
}

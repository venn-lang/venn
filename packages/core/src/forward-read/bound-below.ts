import type { AstNode } from "langium";
import type { Document, LetStmt, Ref, Statement } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { boundNames, loopBinding, patternNames } from "../pattern/index.js";

/** A place that holds statements, which is where a `let` puts a name in view. */
type Scope = Document | ast.Block | ast.FnBody;

/**
 * Whether the `let` that binds this name is written below the read.
 *
 * The question a closure cannot answer where it is written, asked of the source
 * instead. Walking outward finds the nearest binding of the spelling, and the
 * two offsets say which came first: a `let` above is the binding in view, a
 * `let` below is a name nothing holds yet, and the same `let` the read sits
 * inside is recursion, which is above it.
 *
 * The walk stops at the body of a declaration whose name the file hands out, so
 * a `fn` reaching for one of the file's own names is left alone: those are
 * bound for the whole file and read when the function is called, which is what
 * makes mutual recursion work. It stops at the file itself for the same reason,
 * and only there: a `flow`, a `step`, a `group` and a lifecycle hook are frames
 * the program runs, so a `let` below one of them is a name nothing holds yet
 * exactly as it is at the top of a file.
 *
 * @param read The name being read, somewhere inside a closure.
 * @returns True when the binding is below the read, in the body that holds both.
 */
export function boundBelow(read: Ref): boolean {
  const at = read.$cstNode?.offset;
  if (at === undefined) return false;
  for (const scope of scopesAbove(read)) {
    if (namesAround(scope.$container).includes(read.name)) return false;
    const binding = letIn(scope, read.name);
    if (binding) return (binding.$cstNode?.offset ?? at) > at;
  }
  return false;
}

/**
 * Every scope between the read and the body of the declaration it sits in, from
 * the nearest outward.
 *
 * The file's own statements are the last of them, and only for a read written
 * among them: `bindGlobals` binds every top-level name before the first `flow`
 * runs, so a top-level `let` written below a `flow` is in view inside it.
 */
function* scopesAbove(read: Ref): Generator<Scope> {
  let inAFrame = false;
  for (let node: AstNode | undefined = read.$container; node; node = node.$container) {
    if (!ast.isBlock(node) && !ast.isFnBody(node) && !ast.isDocument(node)) continue;
    if (ast.isDocument(node) && inAFrame) return;
    yield node;
    if (ownsItsNames(node.$container)) return;
    inAFrame ||= runsAsAFrame(node.$container);
  }
}

/** A body the program runs as a frame of its own, rather than the file's. */
function runsAsAFrame(owner: AstNode | undefined): boolean {
  if (!owner) return false;
  return (
    ast.isFlowDecl(owner) ||
    ast.isStepDecl(owner) ||
    ast.isGroupDecl(owner) ||
    ast.isLifecycleDecl(owner)
  );
}

/**
 * A body whose names the file hands out rather than a frame: the walk ends here
 * because a `fn` calling something declared below it at the top level is legal.
 */
function ownsItsNames(owner: AstNode | undefined): boolean {
  if (!owner) return true;
  return ast.isFnDecl(owner) || ast.isFragmentDecl(owner) || ast.isDecoDecl(owner);
}

/** What the thing around a scope puts in view for it: its item, its parameters. */
function namesAround(owner: AstNode | undefined): readonly string[] {
  if (!owner) return [];
  if (ast.isForEachStmt(owner)) return boundNames(loopBinding(owner));
  if (ast.isMatchArm(owner)) return owner.patterns.flatMap(patternNames);
  if (ast.isRepeatStmt(owner)) return owner.index ? [owner.index] : [];
  if (ast.isLoopStmt(owner)) return owner.state ? [owner.state.name] : [];
  if (ast.isTryStmt(owner)) return owner.error ? [owner.error] : [];
  return takesParams(owner) ? (owner.params?.params ?? []).flatMap((one) => boundNames(one)) : [];
}

/** The four things written with a parameter list, which their bodies see by name. */
function takesParams(
  owner: AstNode,
): owner is ast.FnDecl | ast.FnExpr | ast.FragmentDecl | ast.DecoDecl {
  return (
    ast.isFnDecl(owner) || ast.isFnExpr(owner) || ast.isFragmentDecl(owner) || ast.isDecoDecl(owner)
  );
}

/** The `let` of this scope that binds the name, wherever in the scope it sits. */
function letIn(scope: Scope, name: string): LetStmt | undefined {
  const stmts: readonly (Statement | ast.Declaration)[] = ast.isDocument(scope)
    ? scope.decls
    : scope.stmts;
  const found = stmts.find((one) => ast.isLetStmt(one) && boundNames(one).includes(name));
  return found as LetStmt | undefined;
}

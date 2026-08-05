import {
  type ActionCall,
  type AstNode,
  type CaptureStmt,
  CODES,
  isDocument,
  isNamespaceDecl,
  type LetStmt,
  type MapLit,
  type Problem,
} from "@venn-lang/core";
import { actionTarget, PRELUDE, resolveTarget, splitTarget } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { checkOptions } from "./check-options.js";
import { namesANamespace } from "./names-a-namespace.js";
import { problemAt } from "./problem-at.js";
import { unknownVerb } from "./unknown-verb.js";

/** `http.get "…"` written as a statement. */
export function checkAction(call: ActionCall, ctx: CheckContext): Problem[] {
  return checkTarget({ node: call, target: call.target, opts: call.opts, ctx });
}

/**
 * `let auth = http.post url { … }`. Only the unmistakable call is checked: with
 * no arguments the path could be a field of a variable this pass cannot see, and
 * a false "unknown action" is worse than a missed one.
 */
export function checkLet(stmt: LetStmt, ctx: CheckContext): Problem[] {
  const misplaced = checkPub(stmt, ctx);
  if (misplaced) return [misplaced];
  if (stmt.args.length === 0 && !stmt.opts) return [];
  const target = actionTarget(stmt.value);
  if (target === undefined) {
    const title = "This is not an action to call.";
    return [problemAt({ node: stmt, ctx, spec: CODES.VN2003_UNKNOWN_ACTION, title })];
  }
  return checkTarget({ node: stmt, target, opts: stmt.opts, ctx });
}

/**
 * `pub` on a binding that is somewhere nobody can import it from.
 *
 * A file publishes what another file can import, and a namespace publishes what
 * a name in front of a dot reaches. Everywhere else a `pub` did nothing at all,
 * which is the kind of silence somebody spends an afternoon on.
 *
 * The two places are the ones the scope builder already reads: a `pub let`
 * inside a namespace is a member of it, exactly as a `pub fn` is, so refusing
 * one and taking the other made `const` mean something `fn` did not.
 */
function checkPub(stmt: LetStmt, ctx: CheckContext): Problem | undefined {
  const held = stmt.$container;
  if (!stmt.export || isDocument(held) || isNamespaceDecl(held)) return undefined;
  const title =
    "`pub` publishes at the top of a file or inside a `namespace`, and this one is somewhere else.";
  return problemAt({ node: stmt, ctx, spec: CODES.VN2009_NOT_EXPORTED, title });
}

/** `capture` is folded into `let`; say so where it is written. */
export function checkCapture(stmt: CaptureStmt, ctx: CheckContext): Problem {
  const title =
    "`capture` was removed, use `let` for a value that changes, `const` for one that does not.";
  return problemAt({ node: stmt, ctx, spec: CODES.VN5001_REMOVED_KEYWORD, title });
}

/**
 * A statement call, resolved the way the expression form resolves.
 *
 * The import used to be the gate: an unimported namespace never got as far as
 * "does it publish this verb", so the sentence that names the real mistake was
 * only reachable from a file that had already written the line the reader did
 * not know how to write. Every run loads every plugin, so the gate was never
 * what decided whether the call worked.
 */
function checkTarget(args: {
  node: AstNode;
  target: string;
  opts: MapLit | undefined;
  ctx: CheckContext;
}): Problem[] {
  const { node, target, ctx } = args;
  if (PRELUDE.has(target)) return [];
  const written = splitTarget(target).namespace;
  if (!namesANamespace(written, ctx)) {
    // A name of the file's own wins over a namespace spelled the same way.
    return ctx.declared.has(written) ? [] : [noSuchNamespace({ node, target, ctx })];
  }
  const resolved = ctx.registry.action(resolveTarget(target, ctx.aliases));
  if (!resolved) return [unknownVerb({ node, target, ctx })];
  return checkOptions({ opts: args.opts, params: resolved.action.params, ctx });
}

/** A dotted target whose head names no namespace anything loaded provides. */
function noSuchNamespace(args: { node: AstNode; target: string; ctx: CheckContext }): Problem {
  const { node, target, ctx } = args;
  const title = `Unknown action "${target}": no loaded plugin provides it.`;
  return problemAt({ node, ctx, spec: CODES.VN2003_UNKNOWN_ACTION, title });
}

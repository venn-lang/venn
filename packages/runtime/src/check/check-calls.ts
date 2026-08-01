import {
  type ActionCall,
  type AstNode,
  buildProblem,
  type CaptureStmt,
  CODES,
  isDocument,
  type LetStmt,
  type MapLit,
  type Problem,
} from "@venn-lang/core";
import { actionTarget, nodeSpan, PRELUDE, resolveTarget, splitTarget } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { checkOptions } from "./check-options.js";

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
    return [problem(stmt, ctx, CODES.VN2003_UNKNOWN_ACTION, "This is not an action to call.")];
  }
  return checkTarget({ node: stmt, target, opts: stmt.opts, ctx });
}

/**
 * `pub` on a binding that is not at the top of a file.
 *
 * A file publishes what another file can import, and only its top level is
 * reachable from outside. A `pub` inside a step or a function did nothing at all,
 * which is the kind of silence somebody spends an afternoon on.
 */
function checkPub(stmt: LetStmt, ctx: CheckContext): Problem | undefined {
  if (!stmt.export || isDocument(stmt.$container)) return undefined;
  const title = "`pub` only publishes at the top of a file, and this one is inside something.";
  return problem(stmt, ctx, CODES.VN2009_NOT_EXPORTED, title);
}

/** `capture` is folded into `let`; say so where it is written. */
export function checkCapture(stmt: CaptureStmt, ctx: CheckContext): Problem {
  const title =
    "`capture` was removed — use `let` for a value that changes, `const` for one that does not.";
  return problem(stmt, ctx, CODES.VN5001_REMOVED_KEYWORD, title);
}

/**
 * A namespace is only usable when this file brought it in with `use` (or it is
 * Loading the whole stdlib must not make the import optional.
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
  if (ctx.bound.has(written)) return [];
  if (!ctx.imported.has(written)) return [missingImport(args, written)];
  const resolved = ctx.registry.action(resolveTarget(target, ctx.aliases));
  if (!resolved) {
    return [problem(node, ctx, CODES.VN2003_UNKNOWN_ACTION, `Unknown action "${target}".`)];
  }
  return checkOptions({ opts: args.opts, params: resolved.action.params, ctx });
}

function missingImport(
  args: { node: AstNode; target: string; ctx: CheckContext },
  namespace: string,
): Problem {
  if (!args.ctx.registry.hasNamespace(namespace)) {
    const title = `Unknown action "${args.target}": no loaded plugin provides it.`;
    return problem(args.node, args.ctx, CODES.VN2003_UNKNOWN_ACTION, title);
  }
  const title = `"${namespace}" is not imported in this file.`;
  const found = problem(args.node, args.ctx, CODES.VN2007_NAMESPACE_NOT_IMPORTED, title);
  return {
    ...found,
    help: `Write \`import { ${namespace} } from "…"\` for the package it comes from.`,
  };
}

function problem(
  node: AstNode,
  ctx: CheckContext,
  spec: (typeof CODES)[keyof typeof CODES],
  title: string,
): Problem {
  return buildProblem({ spec, span: nodeSpan(node, ctx.uri), title });
}

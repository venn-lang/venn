import {
  type AstNode,
  boundNames,
  buildProblem,
  CODES,
  type DecoDecl,
  decoCannotCall,
  isActionCall,
  isDecoDecl,
  isLetStmt,
  type Problem,
} from "@venn-lang/core";
import { actionTarget, nodeSpan, PRELUDE, splitTarget } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * Check a node written inside a `deco` body, which is not the program and so is
 * not resolved against the registry: `target.wrap(f)` is a verb on the handle
 * the body was handed, and expansion settles what the rest means. The one
 * refusal this pass can make is a verb from a plugin, which cannot work in a
 * `deco` because a decorator runs before the program exists.
 *
 * @returns The node's problems, or `undefined` when the node is not inside a
 * `deco`, which tells the caller to apply the ordinary document checks instead.
 */
export function checkInsideDeco(node: AstNode, ctx: CheckContext): Problem[] | undefined {
  const deco = enclosingDeco(node);
  if (!deco) return undefined;
  const target = calledTarget(node);
  const refused = target === undefined ? undefined : pluginVerb({ deco, target, ctx });
  return refused ? [problem(node, ctx, refused)] : [];
}

/** The `deco` this node is written inside, if any. */
function enclosingDeco(node: AstNode): DecoDecl | undefined {
  for (let at: AstNode | undefined = node; at; at = at.$container) {
    if (isDecoDecl(at)) return at;
  }
  return undefined;
}

/** The dotted name this statement calls, if calling is what it does. */
function calledTarget(node: AstNode): string | undefined {
  if (isActionCall(node)) return node.target;
  if (!isLetStmt(node) || (node.args.length === 0 && !node.opts)) return undefined;
  return actionTarget(node.value);
}

/**
 * Why this call cannot be made from here, if it cannot. Only a head the file can
 * already account for is refused: an imported namespace, a resource, a namespace
 * some loaded plugin owns. Anything else is a name only expansion resolves, and
 * guessing at it would put an error on every well-written decorator.
 */
function pluginVerb(args: {
  deco: DecoDecl;
  target: string;
  ctx: CheckContext;
}): string | undefined {
  const { namespace } = splitTarget(args.target);
  if (PRELUDE.has(args.target) || paramNames(args.deco).has(namespace)) return undefined;
  if (!reachesTheWorld(namespace, args.ctx)) return undefined;
  return decoCannotCall(args.target);
}

function reachesTheWorld(namespace: string, ctx: CheckContext): boolean {
  return (
    ctx.imported.has(namespace) || ctx.bound.has(namespace) || ctx.registry.hasNamespace(namespace)
  );
}

function paramNames(deco: DecoDecl): Set<string> {
  return new Set((deco.params?.params ?? []).flatMap(boundNames));
}

function problem(node: AstNode, ctx: CheckContext, title: string): Problem {
  return buildProblem({ spec: CODES.VN2016_DECO_IMPURE, span: nodeSpan(node, ctx.uri), title });
}

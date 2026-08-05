import {
  type AstNode,
  acceptedKinds,
  CODES,
  type DecoDecl,
  decoCannotCall,
  decoTarget,
  isActionCall,
  isDecoDecl,
  isLetStmt,
  namesBound,
  type Problem,
  verbsOfKind,
} from "@venn-lang/core";
import { actionTarget, PRELUDE, splitTarget } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { problemAt } from "./problem-at.js";

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
  if (target === undefined) return [];
  const missing = handleVerb({ deco, target });
  if (missing) return [problemAt({ node, ctx, spec: CODES.VN2017_DECO_VERB, title: missing })];
  const refused = pluginVerb({ deco, target, ctx });
  return refused ? [problemAt({ node, ctx, spec: CODES.VN2016_DECO_IMPURE, title: refused })] : [];
}

/**
 * A verb the handle does not have, said where it is written.
 *
 * What each kind answers to is a table, known before anything runs, so this
 * needs no body executed. Until now only the run found out, which meant `venn
 * check` called a decorator fine and the run refused it.
 */
function handleVerb(args: { deco: DecoDecl; target: string }): string | undefined {
  const { namespace, name } = splitTarget(args.target);
  if (!name || namespace !== decoTarget(args.deco)?.name) return undefined;
  const kinds = acceptedKinds(args.deco);
  // A `deco` whose signature named no kind is its own problem, reported where
  // the `deco` is declared. Guessing at the surface here would say it twice.
  if (kinds.length === 0) return undefined;
  const offered = [...new Set(kinds.flatMap(verbsOfKind))];
  if (offered.includes(name)) return undefined;
  return `A ${kinds.join(" or ")} has no \`${name}\`. It has ${offered.sort().join(", ")}.`;
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
 * Why this call cannot be made from here, if it cannot.
 *
 * A `deco` body resolves the head of a call against what it has in hand: its
 * own parameters, whatever it binds, and the prelude's values. Two heads it
 * cannot have are worth refusing here, because the file already accounts for
 * them: a prelude verb, and an imported or plugin namespace. Any other name is
 * one only expansion resolves, and guessing at it would put an error on every
 * well-written decorator.
 *
 * A prelude verb is the scheduler's, and a decorator runs before there is a
 * scheduler. Excusing the whole prelude here let `venn check` pass a
 * `deco boom(target: Fn) { fail "…" }` that every run refuses with this code,
 * which is the disagreement between the two commands that this pass exists to
 * prevent.
 */
function pluginVerb(args: {
  deco: DecoDecl;
  target: string;
  ctx: CheckContext;
}): string | undefined {
  const { namespace } = splitTarget(args.target);
  if (namesBound(args.deco).has(namespace)) return undefined;
  const refused = PRELUDE.has(args.target) || reachesTheWorld(namespace, args.ctx);
  return refused ? decoCannotCall(args.target) : undefined;
}

function reachesTheWorld(namespace: string, ctx: CheckContext): boolean {
  return (
    ctx.imported.has(namespace) || ctx.bound.has(namespace) || ctx.registry.hasNamespace(namespace)
  );
}

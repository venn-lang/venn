import {
  type AstNode,
  buildProblem,
  CODES,
  dottedPath,
  isCall,
  isMember,
  type Problem,
} from "@venn-lang/core";
import { nodeSpan, resolveTarget, splitTarget } from "../scheduler/index.js";
import { nearestName } from "../suggest/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * A verb a namespace does not publish, written as an expression.
 *
 * `json.nope "x"` as a statement has been refused since VN2003 existed. The same
 * mistake inside an expression reached nobody: the type of an unknown verb is
 * `dynamic`, so the checker had nothing to say, and the run failed one line
 * later with "this value is not a function".
 *
 * The registry knows every verb of every namespace, which is also where the
 * suggestion comes from.
 */
export function checkVerbCall(node: AstNode, ctx: CheckContext): Problem[] {
  const target = verbTarget(node);
  if (!target) return [];
  const { namespace, name } = splitTarget(target);
  if (!name || !reachesANamespace(namespace, ctx)) return [];
  if (ctx.registry.action(resolveTarget(target, ctx.aliases))) return [];
  if (publishesAValue(target, ctx)) return [];
  return [refuse({ node, target, namespace, ctx })];
}

/**
 * The dotted path this node calls, when it calls one at all.
 *
 * Only the bracketed form: `json.parse(text)`. A bare `json.parse` with no
 * brackets is a value being read, and reading one a namespace does not publish
 * is the same mistake, but a member of something a plugin handed over looks
 * identical here and is none of this check's business.
 */
function verbTarget(node: AstNode): string | undefined {
  if (!isCall(node) || !isMember(node.callee)) return undefined;
  return dottedPath(node.callee);
}

/**
 * A local binding of the same name wins, exactly as it does when it runs.
 *
 * `bound` and not `declared`: an import is what puts a namespace here in the
 * first place, so counting one as a local binding would switch this check off
 * for every namespace there is.
 */
function reachesANamespace(namespace: string, ctx: CheckContext): boolean {
  if (ctx.bound.has(namespace)) return false;
  return ctx.imported.has(namespace) || ctx.aliases.has(namespace);
}

/**
 * A constant the namespace publishes, called rather than read.
 *
 * `math.pi()` is wrong, but not in this check's words: the name exists and is
 * not a verb, which is a different sentence and a different check.
 */
function publishesAValue(target: string, ctx: CheckContext): boolean {
  const real = resolveTarget(target, ctx.aliases);
  return ctx.registry
    .values()
    .some((one) => one.namespace === real.namespace && one.value.name === real.name);
}

function refuse(args: {
  node: AstNode;
  target: string;
  namespace: string;
  ctx: CheckContext;
}): Problem {
  const { node, target, namespace, ctx } = args;
  const real = resolveTarget(target, ctx.aliases);
  const near = nearestName(real.name, verbsOf(real.namespace, ctx));
  const found = buildProblem({
    spec: CODES.VN2003_UNKNOWN_ACTION,
    span: nodeSpan(node, ctx.uri),
    title: `"${namespace}" does not publish "${real.name}".`,
  });
  return near ? { ...found, help: `Did you mean \`${namespace}.${near}\`?` } : found;
}

function verbsOf(namespace: string, ctx: CheckContext): string[] {
  return ctx.registry
    .actions()
    .filter((one) => one.namespace === namespace)
    .map((one) => one.name);
}

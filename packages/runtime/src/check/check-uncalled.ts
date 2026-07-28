import {
  type AstNode,
  buildProblem,
  CODES,
  isCall,
  isLetStmt,
  isMember,
  type Member,
  type Problem,
} from "@venn-lang/core";
import { actionTarget, nodeSpan, resolveTarget } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * A plugin verb named but never called.
 *
 * `let id = data.faker.uuid` runs the verb, because the runtime recognises a
 * bare path that names an action. The same words inside an expression evaluate
 * to the verb itself, so a program meaning to read a value gets a function.
 * Rather than guess which was meant, this asks for the parentheses.
 */
export function checkUncalledAction(node: AstNode, ctx: CheckContext): Problem | undefined {
  if (!isMember(node) || !readsAsValue(node)) return undefined;
  const target = actionTarget(node);
  if (target === undefined) return undefined;
  if (!ctx.registry.action(resolveTarget(target, ctx.aliases))) return undefined;
  return buildProblem({
    spec: CODES.VN2008_UNCALLED_ACTION,
    span: nodeSpan(node, ctx.uri),
    title: `\`${target}\` is a verb, not a value — write \`${target}()\` to call it.`,
  });
}

/**
 * Where naming the verb produces the verb. Skipped when it is the head of a
 * longer path or the thing being called, and when it stands as a statement's
 * value, which the runtime calls anyway.
 */
function readsAsValue(node: Member): boolean {
  const parent = node.$container;
  return !isMember(parent) && !isCall(parent) && !isLetStmt(parent);
}

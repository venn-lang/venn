import {
  type AstNode,
  buildProblem,
  CODES,
  didYouMean,
  nearestName,
  type Problem,
} from "@venn-lang/core";
import { nodeSpan, resolveTarget, splitTarget } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * A verb the namespace does not publish, in the one sentence both call forms
 * say.
 *
 * `io.readFile "x"` and `io.readFile("x")` are the same mistake, and the
 * statement form used to say `Unknown action "io.readFile".` while the
 * expression form said which namespace was asked and what it has instead.
 * Neither reached a file that had not written the import, because the missing
 * import was refused first and this was never asked.
 *
 * @param args The node to underline, the dotted target as written, and the
 * document's context, which is where the registry and the aliases are.
 * @returns The problem, carrying the nearest verb of that namespace when there
 * is one near enough to name.
 */
export function unknownVerb(args: { node: AstNode; target: string; ctx: CheckContext }): Problem {
  const { node, target, ctx } = args;
  const written = splitTarget(target).namespace;
  const real = resolveTarget(target, ctx.aliases);
  const found = buildProblem({
    spec: CODES.VN2003_UNKNOWN_ACTION,
    span: nodeSpan(node, ctx.uri),
    title: `"${written}" does not publish "${real.name}".`,
  });
  const near = nearestName(real.name, verbsOf(real.namespace, ctx));
  return near ? { ...found, help: didYouMean(`${written}.${near}`) } : found;
}

/** Every verb of one namespace, which is the candidate set for the suggestion. */
function verbsOf(namespace: string, ctx: CheckContext): string[] {
  return ctx.registry
    .actions()
    .filter((one) => one.namespace === namespace)
    .map((one) => one.name);
}

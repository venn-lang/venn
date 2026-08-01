import {
  type AstNode,
  buildProblem,
  CODES,
  isActionCall,
  isCall,
  isCaptureStmt,
  isLetStmt,
  isMatcherClause,
  isRunStmt,
  type MatcherClause,
  type Problem,
  type RunStmt,
  walkAst,
} from "@venn-lang/core";
import { readImports } from "../imports/index.js";
import {
  collectAliases,
  collectBoundNames,
  collectNamespaces,
  nodeSpan,
} from "../scheduler/index.js";
import type { CheckArgs, CheckContext } from "./check.types.js";
import { checkAction, checkCapture, checkLet } from "./check-calls.js";
import { checkInsideDeco } from "./check-deco-body.js";
import { checkDecoratorName, decosOf } from "./check-decorator-name.js";
import { checkEnv } from "./check-env.js";
import { checkFragmentCall } from "./check-fragment-call.js";
import { checkInterpolation } from "./check-interpolation.js";
import { checkNamespaceUse } from "./check-namespace-use.js";
import { checkRemovedUse } from "./check-removed-use.js";
import { checkUnbound } from "./check-unbound.js";
import { checkUncalledAction } from "./check-uncalled.js";
import { checkVerbCall } from "./check-verb-call.js";
import { everyBoundName } from "./every-bound-name.js";

/**
 * Statically resolve every action, matcher and fragment reference in a parsed
 * document. The errors the runner would otherwise raise mid-run are surfaced all
 * at once, each with its source span.
 *
 * @param args Document, registry, known fragments and the declared `env` names.
 * @returns One `Problem` per unresolved reference; empty when the document is clean.
 */
export function checkDocument(args: CheckArgs): Problem[] {
  const ctx: CheckContext = {
    registry: args.registry,
    fragments: args.fragments,
    aliases: collectAliases(args.document, args.registry),
    imported: collectNamespaces(args.document, args.registry),
    matchers: new Set(readImports(args.document, args.registry).matchers.keys()),
    bound: collectBoundNames(args.document),
    declared: everyBoundName(args.document),
    decos: decosOf(args.document, args.importedDecos),
    decorators: args.decorators,
    env: args.env ? new Set(args.env) : undefined,
    uri: args.uri ?? "memory://inline.vn",
  };
  const problems: Problem[] = [];
  for (const node of walkAst(args.document)) {
    const inDeco = checkInsideDeco(node, ctx);
    if (inDeco) problems.push(...inDeco);
    else problems.push(...everyCheck(node, ctx));
  }
  return problems;
}

function everyCheck(node: AstNode, ctx: CheckContext): Problem[] {
  const removed = checkRemovedUse(node, ctx);
  if (removed.length > 0) return removed;
  return [
    ...checkNode(node, ctx),
    ...checkNamespaceUse(node, ctx),
    ...checkEnv(node, ctx),
    ...checkInterpolation(node, ctx),
    ...checkUnbound(node, ctx),
    ...checkVerbCall(node, ctx),
    ...checkDecoratorName(node, ctx),
    ...one(checkUncalledAction(node, ctx)),
  ];
}

function checkNode(node: AstNode, ctx: CheckContext): Problem[] {
  if (isActionCall(node)) return checkAction(node, ctx);
  if (isLetStmt(node)) return checkLet(node, ctx);
  if (isCaptureStmt(node)) return [checkCapture(node, ctx)];
  if (isMatcherClause(node)) return one(checkMatcher(node, ctx));
  if (isRunStmt(node)) return one(checkFragment(node, ctx));
  if (isCall(node)) return one(checkFragmentCall(node, ctx));
  return [];
}

function one(problem: Problem | undefined): Problem[] {
  return problem ? [problem] : [];
}

/**
 * A matcher is brought in by its own name, like anything else a package
 * publishes. Resolving against the whole loaded stdlib would make the import
 * decorative, and a file would read as though `contains` came from nowhere.
 */
function checkMatcher(clause: MatcherClause, ctx: CheckContext): Problem | undefined {
  const owner = ctx.registry.matcher(clause.name);
  if (!owner) {
    return problem(clause, ctx, CODES.VN2004_UNKNOWN_MATCHER, `Unknown matcher "${clause.name}".`);
  }
  if (ctx.matchers.has(clause.name)) return undefined;
  const title = `"${clause.name}" is not imported in this file.`;
  const problems = problem(clause, ctx, CODES.VN2007_NAMESPACE_NOT_IMPORTED, title);
  return { ...problems, help: `Write \`import { ${clause.name} } from "${owner.plugin.name}"\`.` };
}

function checkFragment(stmt: RunStmt, ctx: CheckContext): Problem | undefined {
  if (ctx.fragments.has(stmt.target)) return undefined;
  return problem(stmt, ctx, CODES.VN2005_UNKNOWN_FRAGMENT, `Unknown fragment "${stmt.target}".`);
}

function problem(
  node: AstNode,
  ctx: CheckContext,
  spec: (typeof CODES)[keyof typeof CODES],
  title: string,
): Problem {
  return buildProblem({ spec, span: nodeSpan(node, ctx.uri), title });
}

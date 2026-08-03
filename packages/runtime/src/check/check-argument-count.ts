import {
  type AstNode,
  buildProblem,
  type Call,
  CODES,
  dottedPath,
  type Expr,
  isActionCall,
  isCall,
  isLetStmt,
  isMatcherClause,
  isMember,
  type Problem,
  splitCall,
} from "@venn-lang/core";
import type { ArgSpec } from "@venn-lang/sdk";
import {
  invocationOf,
  nodeSpan,
  optionNames,
  PRELUDE,
  resolveTarget,
  takes,
} from "../scheduler/index.js";
import { arityOf, tooManyOrFew } from "./arity.js";
import type { Arity } from "./arity.types.js";
import type { CheckContext } from "./check.types.js";

/**
 * A verb or matcher handed more positional arguments than it takes, or fewer
 * than it needs.
 *
 * The shape of a call was the one thing nothing looked at, which is why a verb
 * could declare an argument it never read, read one it never declared, or read
 * two of them in the wrong order and nobody noticed for a release. `http.get()`
 * with no url and `http.get 42` both checked clean, and `expect res header`
 * with no name failed mid-run with `carry header "null"`.
 *
 * A verb that declares no arguments is not policed: saying nothing about a
 * shape is allowed, and refusing every call against a declaration that does not
 * exist would refuse every plugin that stays quiet.
 */
export function checkArgumentCount(node: AstNode, ctx: CheckContext): Problem[] {
  const written = writtenCall(node, ctx);
  if (!written) return [];
  const arity = arityOf(written.declared);
  if (!arity || within(arity, written.given)) return [];
  const title = tooManyOrFew({ name: written.name, arity, given: written.given });
  return [
    buildProblem({ spec: CODES.VN3002_ARGUMENT_COUNT, span: nodeSpan(node, ctx.uri), title }),
  ];
}

const within = (arity: Arity, given: number): boolean =>
  given >= arity.least && given <= arity.most;

/** One call, whichever syntax spelled it: what it names, and what it was given. */
interface Written {
  name: string;
  declared: readonly ArgSpec[] | undefined;
  given: number;
}

function writtenCall(node: AstNode, ctx: CheckContext): Written | undefined {
  if (isMatcherClause(node)) return matcherCall(node.name, node.args.length, ctx);
  if (isActionCall(node)) return verbCall({ target: node.target, args: node.args, ctx });
  if (isLetStmt(node)) return boundCall(node, ctx);
  if (isCall(node) && isMember(node.callee)) {
    return verbCall({ target: dottedPath(node.callee), args: bracketed(node), ctx });
  }
  return undefined;
}

/** The arguments inside the brackets of `json.parse(text)`. */
function bracketed(node: Call): readonly Expr[] {
  return (node.args?.args ?? []).map((one) => one.value);
}

function matcherCall(name: string, given: number, ctx: CheckContext): Written | undefined {
  const found = ctx.registry.matcher(name);
  return found ? { name, declared: found.matcher.args, given } : undefined;
}

function boundCall(node: AstNode, ctx: CheckContext): Written | undefined {
  const call = invocationOf(node as Parameters<typeof invocationOf>[0]);
  return call ? verbCall({ target: call.target, args: call.args, ctx }) : undefined;
}

/**
 * The verb behind a written call, with its trailing options map set aside.
 *
 * A bare `json.parse` with no brackets is a value being read rather than a call
 * with nothing in it, so only a spelling that is unmistakably a call is counted.
 */
function verbCall(args: {
  target: string | undefined;
  args: readonly Expr[];
  ctx: CheckContext;
}): Written | undefined {
  const { target, ctx } = args;
  if (target === undefined || PRELUDE.has(target)) return undefined;
  const found = ctx.registry.action(resolveTarget(target, ctx.aliases));
  if (!found) return undefined;
  const action = found.action;
  const split = splitCall({ args: args.args, takes: takes(action), options: optionNames(action) });
  return { name: target, declared: action.args, given: split.args.length };
}

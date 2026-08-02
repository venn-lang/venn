import {
  type ActionCall,
  type AstNode,
  buildProblem,
  CODES,
  isActionCall,
  type Problem,
} from "@venn-lang/core";
import { nodeSource, nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * A verb whose argument never reached it.
 *
 * Two ways to write one, and the same empty line comes out of both.
 *
 * `print { a: 1 }` hands over nothing, because a trailing `{ … }` on a verb is
 * its options. That rule is what lets `http.get "/x" { headers }` be written
 * without brackets, and this is what it costs.
 *
 * `print match x { … }` hands over nothing either, for a different reason: a
 * verb may be called with no arguments at all, so that line is two statements,
 * a `print` with nothing and a `match` nobody reads.
 */
export function checkSwallowedArgument(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isActionCall(node) || node.args.length > 0 || node.called) return [];
  if (!SAYS.has(node.target)) return [];
  if (node.opts) return [readAsOptions(node, ctx)];
  const next = nextOnTheSameLine(node);
  return next ? [leftBehind(node, next, ctx)] : [];
}

/**
 * The verbs whose whole job is what they are handed.
 *
 * They take no options at all, so a `{ … }` after one is never what it looks
 * like, and one with nothing at all is a line that says nothing. A plugin's
 * verb is a different matter: what it accepts is declared, and an option it
 * does not accept is already `VN3001`.
 */
const SAYS = new Set(["print", "log", "skip"]);

function readAsOptions(node: ActionCall, ctx: CheckContext): Problem {
  const written = nodeSource(node.opts as AstNode);
  return {
    ...buildProblem({
      spec: CODES.VN5002_SWALLOWED_ARGUMENT,
      span: nodeSpan(node.opts as AstNode, ctx.uri),
      title: `\`${node.target}\` reads this as options, so it has nothing to ${saying(node)}.`,
    }),
    help: `Bracket it to hand it over as a value: \`${node.target} (${written})\`.`,
  };
}

function leftBehind(node: ActionCall, next: AstNode, ctx: CheckContext): Problem {
  return {
    ...buildProblem({
      spec: CODES.VN5002_SWALLOWED_ARGUMENT,
      span: nodeSpan(node, ctx.uri),
      title: `\`${node.target}\` was given nothing, so this ${saying(node)}s an empty line.`,
    }),
    help: `Give it a name first: \`const said = ${shown(next)}\`, then \`${node.target} said\`.`,
  };
}

/**
 * What follows, when it is short enough to write out.
 *
 * A `match` runs to ten lines, and half of one in a suggestion is worse than
 * none. Brackets are not the way out here: `print (match … )` is read as a call
 * to `print`, and a `match` is not something an argument list takes. Binding it
 * is.
 */
function shown(next: AstNode): string {
  const source = nodeSource(next);
  return source.includes(NEWLINE) || source.length > TOO_LONG ? "…" : source;
}

const NEWLINE = String.fromCharCode(10);
const TOO_LONG = 40;

/**
 * What comes next, when it was written on the line this verb ends on.
 *
 * Two statements on one line is what the grammar makes of a verb handed
 * something it cannot take as an argument. On separate lines they are two
 * statements somebody meant.
 */
function nextOnTheSameLine(node: ActionCall): AstNode | undefined {
  const siblings = held(node.$container);
  const at = siblings.indexOf(node as AstNode);
  const next = at === -1 ? undefined : siblings[at + 1];
  if (!next) return undefined;
  return endLine(node) === startLine(next) ? next : undefined;
}

function held(container: AstNode | undefined): AstNode[] {
  const parts = container as { decls?: AstNode[]; stmts?: AstNode[] } | undefined;
  return parts?.decls ?? parts?.stmts ?? [];
}

interface Placed {
  $cstNode?: { range?: { start?: { line?: number }; end?: { line?: number } } };
}

function startLine(node: AstNode): number {
  return (node as Placed).$cstNode?.range?.start?.line ?? -1;
}

function endLine(node: AstNode): number {
  return (node as Placed).$cstNode?.range?.end?.line ?? -2;
}

function saying(node: ActionCall): string {
  return node.target === "print" ? "print" : "say";
}

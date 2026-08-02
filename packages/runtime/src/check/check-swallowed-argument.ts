import {
  type ActionCall,
  type AstNode,
  buildProblem,
  CODES,
  isActionCall,
  type Problem,
} from "@venn-lang/core";
import { nodeSource, nodeSpan, PRELUDE, resolveTarget, splitTarget } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * A verb whose argument never reached it.
 *
 * Two ways to write one, and the same empty line comes out of both.
 *
 * `print { a: 1 }` hands over nothing, because a trailing `{ … }` on a verb is
 * its options. That rule is what lets `http.get "/x" { headers }` be written
 * without brackets, and this is what it costs: any verb that declares no
 * options of its own reads the map as them anyway, whether it is a prelude
 * word or a plugin's, and whatever the map held is gone.
 *
 * `print match x { … }` hands over nothing either, for a different reason: a
 * verb may be called with no arguments at all, so that line is two statements,
 * a `print` with nothing and a `match` nobody reads.
 */
export function checkSwallowedArgument(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isActionCall(node) || node.args.length > 0 || node.called) return [];
  if (!swallows(node, ctx)) return [];
  if (node.opts) return [readAsOptions(node, ctx)];
  const next = nextOnTheSameLine(node);
  return next ? [leftBehind(node, next, ctx)] : [];
}

/**
 * Whether this verb has nowhere for a bare `{ … }` to go.
 *
 * A prelude word takes no options at all, `fail` excepted: `{ code, data }`
 * is genuinely read there, just not through a schema. A plugin's action says
 * so directly, in whether it declared a `params` schema; one that takes a
 * free-form map (`grpc.request`) still declared one, and is left alone. A
 * name this pass cannot resolve is left to whichever check already refuses
 * it, rather than guessed at here as well.
 */
function swallows(node: ActionCall, ctx: CheckContext): boolean {
  if (node.target === "fail") return false;
  if (PRELUDE.has(node.target)) return true;
  const namespace = splitTarget(node.target).namespace;
  if (ctx.bound.has(namespace) || !ctx.imported.has(namespace)) return false;
  const resolved = ctx.registry.action(resolveTarget(node.target, ctx.aliases));
  return resolved !== undefined && resolved.action.params === undefined;
}

function readAsOptions(node: ActionCall, ctx: CheckContext): Problem {
  const written = nodeSource(node.opts as AstNode);
  return {
    ...buildProblem({
      spec: CODES.VN5007_OPTIONS_NOT_A_VALUE,
      span: nodeSpan(node.opts as AstNode, ctx.uri),
      title: `\`${node.target}\` takes no options, so this is read as them, and the value inside is lost.`,
    }),
    help: `Bracket it to hand it over as a value: \`${node.target} (${written})\`.`,
  };
}

function leftBehind(node: ActionCall, next: AstNode, ctx: CheckContext): Problem {
  return {
    ...buildProblem({
      spec: CODES.VN5007_OPTIONS_NOT_A_VALUE,
      span: nodeSpan(node, ctx.uri),
      title: `\`${node.target}\` was given nothing, and the line after it went unread.`,
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
 * What comes next, when it was written on the line this verb ends on, with
 * nothing to say the two are separate statements on purpose.
 *
 * Two statements on one line is what the grammar makes of a verb handed
 * something it cannot take as an argument. On separate lines they are two
 * statements somebody meant, and `;` is the lexer's other spelling of a
 * newline: `mock.reset; mock.start "x"` reports the same line for both, and
 * is exactly as deliberate as writing them on two lines would be.
 */
function nextOnTheSameLine(node: ActionCall): AstNode | undefined {
  const siblings = held(node.$container);
  const at = siblings.indexOf(node as AstNode);
  const next = at === -1 ? undefined : siblings[at + 1];
  if (!next || endLine(node) !== startLine(next)) return undefined;
  return separatedByHand(node as AstNode, next) ? undefined : next;
}

function held(container: AstNode | undefined): AstNode[] {
  const parts = container as { decls?: AstNode[]; stmts?: AstNode[] } | undefined;
  return parts?.decls ?? parts?.stmts ?? [];
}

interface Placed {
  $cstNode?: {
    offset?: number;
    length?: number;
    range?: { start?: { line?: number }; end?: { line?: number } };
    root?: { fullText?: string };
  };
}

function startLine(node: AstNode): number {
  return (node as Placed).$cstNode?.range?.start?.line ?? -1;
}

function endLine(node: AstNode): number {
  return (node as Placed).$cstNode?.range?.end?.line ?? -2;
}

/** Whether a `;` sits in the gap between one statement and the next. */
function separatedByHand(node: AstNode, next: AstNode): boolean {
  const from = (node as Placed).$cstNode;
  const to = (next as Placed).$cstNode;
  if (from === undefined || to === undefined) return false;
  const text = from.root?.fullText;
  if (text === undefined || from.offset === undefined || to.offset === undefined) return false;
  return text.slice(from.offset + (from.length ?? 0), to.offset).includes(";");
}

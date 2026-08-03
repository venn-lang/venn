import {
  type AstNode,
  buildProblem,
  CODES,
  type Expr,
  type InterpolationSlot,
  isAnnotation,
  isStringLit,
  markSlotIn,
  type Problem,
  parseExpression,
  type Span,
  scanInterpolations,
  walkAst,
} from "@venn-lang/core";
import type { CheckContext } from "./check.types.js";
import { envProblemsIn } from "./check-env.js";
import { checkUnbound, underADecorator } from "./check-unbound.js";
import { everyBoundName } from "./every-bound-name.js";

/**
 * Check each `${…}` placeholder in a string literal and point at the placeholder
 * itself, not at the whole string. A slot that does not parse would otherwise
 * evaluate to an empty string, so a typo inside a URL fails as a puzzling 404.
 */
export function checkInterpolation(node: AstNode, ctx: CheckContext): Problem[] {
  const cst = node.$cstNode;
  if (!isStringLit(node) || !cst || insideAnnotation(node)) return [];
  // The slot is parsed apart from the file, so the walk out of it never reaches
  // the declaration it sits in. Asked here, where the string still knows.
  const decorated = underADecorator(node);
  return scanInterpolations(cst.text).flatMap((slot) =>
    inSlot({ slot, host: node, span: spanOf(slot, { cst, uri: ctx.uri }), ctx, decorated }),
  );
}

/**
 * A bare name inside a decorator is a word, not a reference, so a string there
 * is decorator arguments rather than code. The AST walk skips those for the
 * same reason.
 */
function insideAnnotation(node: AstNode): boolean {
  for (let at = node.$container; at; at = at.$container) if (isAnnotation(at)) return true;
  return false;
}

/**
 * A URL is where `env` reads live, and a placeholder is where a name is most
 * often mistyped. Both are asked here, because the document's own tree stops at
 * the string and neither would otherwise be asked at all.
 */
function inSlot(args: {
  slot: InterpolationSlot;
  host: AstNode;
  span: Span;
  ctx: CheckContext;
  decorated: boolean;
}): Problem[] {
  const expr = parsed(args.slot, args.host);
  if (!expr) return [unreadable(args.slot, args.span)];
  const env = envProblemsIn(args.slot.source, args.span, args.ctx);
  return args.decorated ? env : [...env, ...unbound(expr, args.ctx)];
}

/** The slot's expression, told where it was written so a problem points at it. */
function parsed(slot: InterpolationSlot, host: AstNode): Expr | undefined {
  const expr = parseExpression(slot.source);
  if (expr) markSlotIn({ expr, host, start: slot.sourceStart });
  return expr;
}

/**
 * Names the slot reads and nothing binds.
 *
 * `"id=${noSuchName}"` used to interpolate as the empty string and survive into
 * a passing assertion, while the same name outside the string was refused.
 * Whatever the slot binds itself, a lambda's parameter above all, is added to
 * what the file binds: the expression was parsed apart from the document, so
 * the document cannot know about it.
 */
function unbound(expr: Expr, ctx: CheckContext): Problem[] {
  const own = everyBoundName(expr);
  const declared = own.size === 0 ? ctx.declared : new Set([...ctx.declared, ...own]);
  return [expr, ...walkAst(expr)].flatMap((node) => checkUnbound(node, { ...ctx, declared }));
}

function unreadable(slot: InterpolationSlot, span: Span): Problem {
  return buildProblem({
    spec: CODES.VN1002_PARSE,
    span,
    title: `Cannot read \`\${${slot.source}}\`, that is not an expression.`,
  });
}

/** The span of the placeholder itself: line and column follow the string's own start. */
function spanOf(
  slot: InterpolationSlot,
  target: {
    cst: { offset: number; range?: { start: { line: number; character: number } } };
    uri: string;
  },
): Span {
  const start = target.cst.range?.start;
  return {
    uri: target.uri,
    offset: target.cst.offset + slot.start,
    length: slot.end - slot.start,
    line: (start?.line ?? 0) + 1,
    column: (start?.character ?? 0) + 1 + slot.start,
  };
}

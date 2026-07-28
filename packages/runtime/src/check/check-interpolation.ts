import {
  type AstNode,
  buildProblem,
  CODES,
  type InterpolationSlot,
  isStringLit,
  type Problem,
  parseExpression,
  type Span,
  scanInterpolations,
} from "@venn/core";
import type { CheckContext } from "./check.types.js";
import { envProblemsIn } from "./check-env.js";

/**
 * Check each `${…}` placeholder in a string literal and point at the placeholder
 * itself, not at the whole string. A slot that does not parse would otherwise
 * evaluate to an empty string, so a typo inside a URL fails as a puzzling 404.
 */
export function checkInterpolation(node: AstNode, ctx: CheckContext): Problem[] {
  const cst = node.$cstNode;
  if (!isStringLit(node) || !cst) return [];
  return scanInterpolations(cst.text).flatMap((slot) =>
    inSlot(slot, spanOf(slot, { cst, uri: ctx.uri }), ctx),
  );
}

/** A URL is where `env` reads live, so they are checked here as well as in the AST. */
function inSlot(slot: InterpolationSlot, span: Span, ctx: CheckContext): Problem[] {
  if (!parseExpression(slot.source)) return [unreadable(slot, span)];
  return envProblemsIn(slot.source, span, ctx);
}

function unreadable(slot: InterpolationSlot, span: Span): Problem {
  return buildProblem({
    spec: CODES.VN1002_PARSE,
    span,
    title: `Cannot read \`\${${slot.source}}\` — that is not an expression.`,
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

import type { Call } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { scanInterpolations } from "../interpolation/index.js";

/**
 * Whether a `regex(…)` written out will compile, asked before anything runs.
 *
 * A pattern spelled wrong is knowable the moment it is written, and finding out
 * at run time means finding out on the line that used it rather than the line
 * that wrote it. Only a literal can be checked: a pattern built from a value is
 * whatever that value turns out to be.
 *
 * @param expr The call, which may or may not be to `regex`.
 * @returns The problem's title, or nothing when there is nothing to say.
 */
export function badPatternIn(expr: Call): string | undefined {
  const source = literalPattern(expr);
  if (source === undefined) return undefined;
  try {
    new RegExp(source);
    return undefined;
  } catch (error) {
    return title(source, error);
  }
}

/**
 * The pattern text, when the call is `regex("…")` with nothing to work out.
 *
 * A `${…}` inside it makes the pattern a run-time value, so there is nothing
 * here to be right or wrong about yet.
 */
function literalPattern(expr: Call): string | undefined {
  if (!ast.isRef(expr.callee) || expr.callee.name !== "regex") return undefined;
  const first = expr.args?.args?.[0]?.value;
  if (!first || !ast.isStringLit(first)) return undefined;
  return scanInterpolations(first.value).length > 0 ? undefined : first.value;
}

function title(source: string, error: unknown): string {
  const why =
    error instanceof Error ? error.message.replace(/^Invalid regular expression: /, "") : "";
  return `This is not a pattern: ${source}. ${why}`.trim();
}

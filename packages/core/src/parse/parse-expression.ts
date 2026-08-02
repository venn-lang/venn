import type { Expr, FlowDecl, ReturnStmt, StepDecl } from "../generated/ast.js";
import { parse } from "./parse.js";

/**
 * `return` and not `expect`, because `expect` takes a block of checks as well as
 * a subject, so `expect {}` is an empty block and `${{}}` came back holding
 * nothing. Nowhere after `return` can a `{` open a block, so a map literal there
 * is the value it looks like, at every size.
 */
const PREFIX = 'flow "e" { step "e" { return ';
const SUFFIX = " } }";

/**
 * How far {@link parseExpression} shifts CST offsets. Exported because the
 * editor maps the parsed expression back onto the `${…}` it came from, and a
 * hand-counted constant there would rot the moment this wrapper changes.
 */
export const EXPRESSION_OFFSET: number = PREFIX.length;

/**
 * Parse a standalone expression by wrapping it in a minimal flow and reading
 * back the value it returns. Used by string interpolation (`${…}`).
 *
 * @returns The expression, or `undefined` when the source does not parse.
 */
export function parseExpression(source: string): Expr | undefined {
  const { ast, problems } = parse(`${PREFIX}${source}${SUFFIX}`);
  if (problems.length > 0) return undefined;
  const flow = ast.decls[0] as FlowDecl | undefined;
  const step = flow?.body.stmts[0] as StepDecl | undefined;
  const stmt = step?.body.stmts[0] as ReturnStmt | undefined;
  return stmt?.value;
}

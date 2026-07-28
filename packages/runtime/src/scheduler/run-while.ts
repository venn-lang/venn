import { buildProblem, CODES, evaluate, ProblemError, truthy, type WhileStmt } from "@venn/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import { runBlock } from "./run-block.js";
import { settle } from "./settled.js";
import { BreakSignal, ContinueSignal } from "./signals.js";

/**
 * Every `while` has an inherited timeout in the language; this is the hard cap
 * that stands in for it until timeouts are wired.
 */
const MAX_ITERATIONS = 100_000;

/** `while cond { … }`: loop while the condition is truthy. */
export async function runWhile(engine: Engine, stmt: WhileStmt, scope: Scope): Promise<void> {
  let guard = 0;
  while (truthy(await settle(evaluate(stmt.cond, scope)))) {
    if (++guard > MAX_ITERATIONS) throw neverFinished(engine, stmt);
    try {
      await runBlock(engine, stmt.body, scope.child());
    } catch (error) {
      if (error instanceof BreakSignal) break;
      if (error instanceof ContinueSignal) continue;
      throw error;
    }
  }
}

/**
 * Reaching the cap is not the loop finishing, so it is raised rather than
 * returned: stopping at the limit in silence would report a pass.
 */
function neverFinished(engine: Engine, stmt: WhileStmt): ProblemError {
  return new ProblemError(
    buildProblem({
      spec: CODES.VN8002_LOOP_LIMIT,
      span: nodeSpan(stmt, engine.uri),
      title: `This while loop ran ${MAX_ITERATIONS} times and its condition was still true.`,
      help: "Change something the condition reads inside the loop, or use `repeat n` to bound it.",
    }),
  );
}

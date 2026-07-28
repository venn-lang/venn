import {
  buildProblem,
  CODES,
  evaluate,
  ProblemError,
  type RepeatStmt,
  typeName,
} from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import { runBlock } from "./run-block.js";
import { BreakSignal, ContinueSignal } from "./signals.js";

/** `repeat N as i { … }`: run the body N times, honouring break/continue. */
export async function runRepeat(engine: Engine, stmt: RepeatStmt, scope: Scope): Promise<void> {
  const count = toCount(engine, stmt, evaluate(stmt.count, scope));
  for (let i = 1; i <= count; i++) {
    const child = scope.child();
    if (stmt.index) child.set(stmt.index, i);
    try {
      const pending = runBlock(engine, stmt.body, child);
      if (pending) await pending;
    } catch (error) {
      if (error instanceof BreakSignal) break;
      if (error instanceof ContinueSignal) continue;
      throw error;
    }
  }
}

/**
 * A count the machine cannot read as one is refused, because running the body
 * zero times would report success: `repeat cfg.times` with nothing behind
 * `times` would check nothing and pass.
 *
 * Zero and below still mean "not at all": a bound that computes to none is a
 * program saying so, not a mistake.
 */
function toCount(engine: Engine, stmt: RepeatStmt, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw notANumber(engine, stmt, value);
  return value > 0 ? Math.floor(value) : 0;
}

function notANumber(engine: Engine, stmt: RepeatStmt, value: unknown): ProblemError {
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3016_NOT_A_NUMBER,
      span: nodeSpan(stmt.count, engine.uri),
      title: `repeat needs a number of times, and this is a ${typeName(value)}.`,
      help: "Give it a count, as in `repeat 3 { … }`.",
    }),
  );
}

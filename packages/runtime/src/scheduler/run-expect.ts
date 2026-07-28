import { buildProblem, CODES, type ExpectStmt, evaluate, truthy } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { nodeSource, nodeSpan } from "./node-span.js";
import { evalMatcher, type MatcherOutcome } from "./run-matcher.js";
import { settle } from "./settled.js";

/** Evaluate an `expect` (matcher clause, `.all` checks, negated, or subject) and emit the outcome. */
export async function runExpect(engine: Engine, stmt: ExpectStmt, scope: Scope): Promise<void> {
  const outcome = stmt.matcher
    ? await evalMatcher({ engine, stmt, scope })
    : { passed: await evalBoolean({ stmt, scope }) };
  record({ engine, stmt, outcome });
}

async function evalBoolean(args: { stmt: ExpectStmt; scope: Scope }): Promise<boolean> {
  return args.stmt.modifier === "all" ? evalChecks(args) : evalSubject(args);
}

async function evalSubject(args: { stmt: ExpectStmt; scope: Scope }): Promise<boolean> {
  if (!args.stmt.subject) return true;
  const value = truthy(await settle(evaluate(args.stmt.subject, args.scope)));
  return args.stmt.negate ? !value : value;
}

async function evalChecks(args: { stmt: ExpectStmt; scope: Scope }): Promise<boolean> {
  for (const check of args.stmt.checks) {
    if (!truthy(await settle(evaluate(check, args.scope)))) return false;
  }
  return true;
}

function record(args: { engine: Engine; stmt: ExpectStmt; outcome: MatcherOutcome }): void {
  if (args.outcome.passed) {
    args.engine.result.passed += 1;
    args.engine.emitter.emit({ kind: "expect.passed", data: { source: nodeSource(args.stmt) } });
    return;
  }
  args.engine.result.failed += 1;
  const problem = buildProblem({
    spec: CODES.VN6001_ASSERTION_FAILED,
    span: nodeSpan(args.stmt, args.engine.uri),
    title: args.outcome.message ?? `Expectation failed: ${nodeSource(args.stmt)}`,
    // The title is one line; the two sides it summarises travel as the body.
    diff: args.outcome.diff,
  });
  args.engine.emitter.emit({ kind: "expect.failed", data: { problem } });
}

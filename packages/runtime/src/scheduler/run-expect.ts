import {
  buildProblem,
  CODES,
  type ExpectStmt,
  type Expr,
  evaluate,
  type Problem,
  truthy,
} from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import { AssertionFailed } from "./assertion-failed.js";
import type { Engine } from "./engine.types.js";
import { nodeSource, nodeSpan } from "./node-span.js";
import { reportProblem } from "./report-failure.js";
import { evalMatcher, type MatcherOutcome } from "./run-matcher.js";
import { settle } from "./settled.js";

/**
 * Evaluate an `expect` (matcher clause, `.all` checks, negated, or subject) and
 * report the outcome.
 *
 * A hard failure reports nothing here. It throws what it found and lets whoever
 * catches it last decide: the step reports it, a `try` around it handles it and
 * reports none, and a `@retry` attempt thrown away leaves no trace of a check
 * the run went on to pass. Reported here instead, a handled assertion sat on the
 * stream for every reporter to draw while the run exited 0.
 *
 * @param engine The frame this assertion belongs to.
 * @param stmt The assertion as written.
 * @param scope What its expressions read from.
 * @raises {@link AssertionFailed} carrying VN6001 on a hard failure, which is
 * what stops the step and what `try { expect … } catch e { e.code }` binds.
 * `.soft` records and returns instead.
 */
export async function runExpect(engine: Engine, stmt: ExpectStmt, scope: Scope): Promise<void> {
  if (stmt.modifier === "all" && !stmt.matcher) return runChecks({ engine, stmt, scope });
  const outcome = stmt.matcher
    ? await evalMatcher({ engine, stmt, scope })
    : { passed: await evalSubject({ stmt, scope }) };
  if (outcome.passed) return passed(engine, stmt);
  const problem = problemOf({ engine, stmt, outcome });
  // `.soft` was recorded deliberately and nobody handles it, so it reports here
  // and carries on. The plain form is the one that stops the step.
  if (stmt.modifier !== "soft") throw new AssertionFailed([problem]);
  reportProblem({ engine, problem, kind: "expect.soft_failed" });
}

async function evalSubject(args: { stmt: ExpectStmt; scope: Scope }): Promise<boolean> {
  if (!args.stmt.subject) return true;
  const value = truthy(await settle(evaluate(args.stmt.subject, args.scope)));
  return args.stmt.negate ? !value : value;
}

/**
 * `.all { … }`: every check, then one abort.
 *
 * Each failing check is named by its own source and travels on the one throw,
 * because a block that stopped at the first one would be the plain form under a
 * longer name, and one title covering four checks says nothing about which of
 * them was false. Carrying all of them is also what makes a caught `.all`
 * report none, symmetric with a caught single check.
 */
async function runChecks(args: { engine: Engine; stmt: ExpectStmt; scope: Scope }): Promise<void> {
  const lost: Problem[] = [];
  for (const check of args.stmt.checks) {
    if (truthy(await settle(evaluate(check, args.scope)))) continue;
    lost.push(checkProblem(args.engine, check));
  }
  if (lost.length > 0) throw new AssertionFailed(lost);
  passed(args.engine, args.stmt);
}

function passed(engine: Engine, stmt: ExpectStmt): void {
  engine.result.passed += 1;
  engine.emitter.emit({ kind: "expect.passed", data: { source: nodeSource(stmt) } });
}

function problemOf(args: { engine: Engine; stmt: ExpectStmt; outcome: MatcherOutcome }): Problem {
  return buildProblem({
    spec: CODES.VN6001_ASSERTION_FAILED,
    span: nodeSpan(args.stmt, args.engine.uri),
    title: args.outcome.message ?? `Expectation failed: ${nodeSource(args.stmt)}`,
    // The title is one line; the two sides it summarises travel as the body.
    diff: args.outcome.diff,
  });
}

function checkProblem(engine: Engine, check: Expr): Problem {
  return buildProblem({
    spec: CODES.VN6001_ASSERTION_FAILED,
    span: nodeSpan(check, engine.uri),
    title: `Expectation failed: ${nodeSource(check)}`,
  });
}

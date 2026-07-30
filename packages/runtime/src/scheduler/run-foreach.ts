import {
  buildProblem,
  CODES,
  evaluate,
  type ForEachStmt,
  loopBinding,
  ProblemError,
  typeName,
} from "@venn-lang/core";
import { binderFor, type Scope } from "../scope/index.js";
import { planOf } from "./block-plan.js";
import { runPool } from "./concurrency.js";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import { optsNumber } from "./opts.js";
import type { Pending } from "./pending.types.js";
import { runBlock, runSteps } from "./run-block.js";
import { settle } from "./settled.js";
import { BreakSignal, ContinueSignal } from "./signals.js";

/** `forEach x in list { concurrency: N } { … }`: iterate, up to N in flight. */
export async function runForEach(engine: Engine, stmt: ForEachStmt, scope: Scope): Promise<void> {
  const source = await settle(evaluate(stmt.source, scope));
  if (!Array.isArray(source)) throw notAList({ engine, stmt, source });
  const concurrency = optsNumber(stmt.opts, "concurrency", scope) ?? 1;
  // One at a time is the default and by far the common case: run it as a plain
  // loop rather than through the pool, which allocates a worker, an array and a
  // `Promise.all` to supervise a single sequential walk.
  if (concurrency === 1) return sequential(engine, stmt, source, scope);
  await runPool(source, concurrency, (item) => runIteration({ engine, stmt, item, scope }));
}

/**
 * Anything but a list is refused, because iterating it zero times would report
 * success: a test that checked nothing, dressed as one that passed. Built here,
 * off the iteration path, so the loop itself pays nothing for it.
 */
function notAList(args: { engine: Engine; stmt: ForEachStmt; source: unknown }): ProblemError {
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3015_NOT_A_LIST,
      span: nodeSpan(args.stmt.source, args.engine.uri),
      title: `forEach needs a list, and this is a ${typeName(args.source)}.`,
      help: helpFor(args.source),
    }),
  );
}

/** The everyday cause: an endpoint answering `{ data: [...] }` rather than a list. */
function helpFor(source: unknown): string | undefined {
  if (typeName(source) !== "map") return undefined;
  return "Name the list inside it, as in `forEach item in res.data`.";
}

/**
 * Walk the items one at a time, staying synchronous for as long as the body
 * does. A body of pure work (a binding, a comparison, arithmetic) never
 * suspends, so 50k iterations cost no promises at all. The first iteration that
 * does suspend hands the remainder to {@link resume}, from where it left off.
 */
function sequential(
  engine: Engine,
  stmt: ForEachStmt,
  items: readonly unknown[],
  scope: Scope,
): Pending {
  const plan = planOf(stmt.body);
  const bind = binderFor(loopBinding(stmt));
  if (plan.defers) return slowSequential(engine, stmt, items, scope);
  const child = scope.child();
  for (let at = 0; at < items.length; at += 1) {
    try {
      bind(items[at], child);
      const pending = runSteps(engine, plan.steps, child);
      if (pending) return resume(engine, stmt, items, at + 1, scope, pending);
    } catch (error) {
      if (error instanceof BreakSignal) return undefined;
      if (error instanceof ContinueSignal) continue;
      throw error;
    }
  }
  return undefined;
}

function slowSequential(
  engine: Engine,
  stmt: ForEachStmt,
  items: readonly unknown[],
  scope: Scope,
): Pending {
  for (let at = 0; at < items.length; at += 1) {
    try {
      const pending = iterate(engine, stmt, items[at], scope);
      if (pending) return resume(engine, stmt, items, at + 1, scope, pending);
    } catch (error) {
      if (error instanceof BreakSignal) return undefined;
      if (error instanceof ContinueSignal) continue;
      throw error;
    }
  }
  return undefined;
}

function iterate(engine: Engine, stmt: ForEachStmt, item: unknown, scope: Scope): Pending {
  const child = scope.child();
  binderFor(loopBinding(stmt))(item, child);
  return runBlock(engine, stmt.body, child);
}

async function resume(
  engine: Engine,
  stmt: ForEachStmt,
  items: readonly unknown[],
  from: number,
  scope: Scope,
  pending: Promise<void>,
): Promise<void> {
  try {
    await pending;
  } catch (error) {
    if (error instanceof BreakSignal) return;
    if (!(error instanceof ContinueSignal)) throw error;
  }
  for (let at = from; at < items.length; at += 1) {
    try {
      await iterate(engine, stmt, items[at], scope);
    } catch (error) {
      if (error instanceof BreakSignal) return;
      if (error instanceof ContinueSignal) continue;
      throw error;
    }
  }
}

async function runIteration(args: {
  engine: Engine;
  stmt: ForEachStmt;
  item: unknown;
  scope: Scope;
}): Promise<void> {
  const child = args.scope.child();
  binderFor(loopBinding(args.stmt))(args.item, child);
  try {
    await runBlock(args.engine, args.stmt.body, child);
  } catch (error) {
    if (error instanceof BreakSignal || error instanceof ContinueSignal) return;
    throw error;
  }
}

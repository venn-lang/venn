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
import { checkpoint } from "./checkpoint.js";
import { runPool } from "./concurrency.js";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import type { Pending } from "./pending.types.js";
import { readOptions } from "./read-options.js";
import { runBlock } from "./run-block.js";
import { settle } from "./settled.js";
import { BreakSignal, ContinueSignal } from "./signals.js";

/** `forEach x in list { concurrency: N } { … }`: iterate, up to N in flight. */
export async function runForEach(engine: Engine, stmt: ForEachStmt, scope: Scope): Promise<void> {
  const source = await settle(evaluate(stmt.source, scope));
  if (!Array.isArray(source)) throw notAList({ engine, stmt, source });
  const opts = await readOptions({ opts: stmt.opts, kind: "ForEachStmt", scope, uri: engine.uri });
  const concurrency = (opts.concurrency as number | undefined) ?? 1;
  // One at a time is the default and by far the common case: run it as a plain
  // loop rather than through the pool, which allocates a worker, an array and a
  // `Promise.all` to supervise a single sequential walk.
  if (concurrency === 1) return sequential(engine, stmt, source, scope);
  await concurrently({ engine, stmt, items: source, scope, concurrency });
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
 * One pass over one item, wherever the pass came from.
 *
 * The one routine every way of running this loop goes through, so there is
 * nothing for them to disagree about. Four of them once did: three built a
 * child scope per item and the fast one hoisted a single child out of the loop,
 * so a closure made in a pass captured the last pass's value, and which of the
 * two you got depended on whether the body held a `defer` or the options held a
 * `concurrency`. A pass is one binding, and one binding is one scope.
 */
function onePass(args: {
  engine: Engine;
  stmt: ForEachStmt;
  item: unknown;
  scope: Scope;
}): Pending {
  const child = args.scope.child();
  binderFor(loopBinding(args.stmt))(args.item, child);
  return runBlock(args.engine, args.stmt.body, child);
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
  for (let at = 0; at < items.length; at += 1) {
    checkpoint(engine);
    try {
      const pending = onePass({ engine, stmt, item: items[at], scope });
      if (pending) return resume({ engine, stmt, items, from: at + 1, scope, pending });
    } catch (error) {
      if (error instanceof BreakSignal) return undefined;
      if (error instanceof ContinueSignal) continue;
      throw error;
    }
  }
  return undefined;
}

/** The same walk, awaiting, entered with whatever the pass that suspended left. */
async function resume(args: {
  engine: Engine;
  stmt: ForEachStmt;
  items: readonly unknown[];
  from: number;
  scope: Scope;
  pending: Promise<void>;
}): Promise<void> {
  const { engine, stmt, items, scope } = args;
  if (await stopped(args.pending)) return;
  for (let at = args.from; at < items.length; at += 1) {
    checkpoint(engine);
    try {
      await onePass({ engine, stmt, item: items[at], scope });
    } catch (error) {
      if (error instanceof BreakSignal) return;
      if (error instanceof ContinueSignal) continue;
      throw error;
    }
  }
}

/** Whether what was already in flight ended the loop. `continue` does not. */
async function stopped(pending: Promise<void>): Promise<boolean> {
  try {
    await pending;
    return false;
  } catch (error) {
    if (error instanceof BreakSignal) return true;
    if (error instanceof ContinueSignal) return false;
    throw error;
  }
}

/**
 * `{ concurrency: N }`: the same pass, N in flight.
 *
 * A `break` ends the loop rather than the one iteration that wrote it. Ending
 * only its own left the cursor running: `[1..6]` at two in flight with a `break`
 * on the second item still ran items three to six, which is the opposite of what
 * `break` means and of what the same loop does at one in flight.
 */
async function concurrently(args: {
  engine: Engine;
  stmt: ForEachStmt;
  items: readonly unknown[];
  scope: Scope;
  concurrency: number;
}): Promise<void> {
  const broke = { yet: false };
  await runPool({
    items: args.items,
    limit: args.concurrency,
    task: (item) => runIteration({ ...args, item, broke }),
    stop: () => broke.yet || args.engine.cancel?.stopped() !== undefined,
  });
}

async function runIteration(args: {
  engine: Engine;
  stmt: ForEachStmt;
  item: unknown;
  scope: Scope;
  broke: { yet: boolean };
}): Promise<void> {
  try {
    await onePass(args);
  } catch (error) {
    if (error instanceof BreakSignal) args.broke.yet = true;
    else if (!(error instanceof ContinueSignal)) throw error;
  }
}

import { VennError } from "@venn-lang/contracts";
import type { Annotation, SpanNode } from "@venn-lang/core";
import { type CancelScope, createCancelScope, unwind } from "../cancel/index.js";
import { RUN_CODES } from "../codes.js";
import type { Scope } from "../scope/index.js";
import { reportAbandoned } from "./abandoned.js";
import { type RetrySpec, readRetry, readTimeout } from "./annotations.js";
import { branchEngine } from "./branch-engine.js";
import { checkpoint } from "./checkpoint.js";
import type { Engine } from "./engine.types.js";
import { nodeSpan } from "./node-span.js";
import type { Scoped, TimeoutArgs } from "./run-attempts.types.js";
import { isControlSignal } from "./signals.js";

interface AnnotatedNode extends SpanNode {
  annotations: Annotation[];
}

/** Run a step/flow body applying its `@timeout` and `@retry` annotations. */
export async function runWithAnnotations(args: {
  engine: Engine;
  node: AnnotatedNode;
  scope: Scope;
  title: string;
  run: Scoped;
}): Promise<void> {
  const bounds = { timeoutMs: readTimeout(args.node), where: nodeSpan(args.node, args.engine.uri) };
  const attempt = (): Promise<void> =>
    withTimeout({ engine: args.engine, ...bounds, run: args.run });
  const retry = readRetry(args.node);
  if (!retry || retry.attempts === 0) return attempt();
  await withRetry({ engine: args.engine, retry, title: args.title, run: attempt });
}

/**
 * Hold the named mutex (`@lock`/`@serial`) around `run`, releasing on exit.
 *
 * Wrapped outside `@timeout` on purpose, now that a timeout waits for its body
 * to unwind: the release therefore happens once the body has actually stopped,
 * and not when the timeout gave up on waiting for it, which is how two holders
 * came to be inside the same lock at once.
 */
export async function withLock(
  engine: Engine,
  name: string | undefined,
  run: () => Promise<void>,
): Promise<void> {
  if (!name) return run();
  const release = await engine.lock.acquire(name);
  try {
    await run();
  } finally {
    release();
  }
}

/**
 * `@timeout(…)`: the body runs under a scope of its own, so what runs out of
 * time is the work and not only the waiting.
 *
 * @param args The engine, how long the body has, and the body.
 * @throws VennError `VN8001` when the body did not finish in time.
 */
export async function withTimeout(args: TimeoutArgs): Promise<void> {
  const ms = args.timeoutMs;
  if (ms === undefined) return args.run(args.engine);
  const scope = timeoutScope(args.engine, ms);
  // The scope's own deadline covers work that never yields; this timer covers
  // work that does, and arrives the instant the time is up rather than at the
  // next statement.
  const timer = setTimeout(() => scope.cancel(timeoutError(ms)), ms);
  try {
    await bounded(args, scope);
  } finally {
    clearTimeout(timer);
    scope.release();
  }
}

function timeoutScope(engine: Engine, ms: number): CancelScope {
  return createCancelScope({
    parent: engine.cancel,
    clock: engine.clock,
    timeout: { ms, raise: () => timeoutError(ms) },
  });
}

/**
 * The body, and the wait for it to actually stop.
 *
 * Abandoning the work and walking away is what ran three copies of a retried
 * body at once, handed a named lock to a second holder while the first was
 * still writing, and let a step's assertions land after the run was tallied.
 * What still cannot be made to stop is named rather than waited on for ever.
 *
 * The wait for the body and the grace for it to unwind are two waits, in that
 * order. Written as one, the grace ran from where the body started rather than
 * from where it was called off, so a `@timeout` longer than the grace gave up
 * watching before its own deadline arrived and never enforced it at all.
 */
async function bounded(args: TimeoutArgs, scope: CancelScope): Promise<void> {
  const body = args.run(branchEngine(args.engine, scope));
  const settled = body.then(done, done);
  await Promise.race([settled, calledOff(scope)]);
  const ended = scope.stopped() ?? overran(args.engine, scope);
  if (ended === undefined) return body;
  if (!(await unwind({ work: [settled] })))
    reportAbandoned({ engine: args.engine, title: LEFT_RUNNING, where: args.where });
  throw ended;
}

function done(): void {}

/** Resolves the moment the scope ends, so the grace starts from there. */
function calledOff(scope: CancelScope): Promise<void> {
  return new Promise((resolve) => {
    if (scope.signal.aborted) return resolve();
    scope.signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

/**
 * The deadline, read from the clock rather than sampled.
 *
 * A body that never yields is stopped at a back edge, where the clock is read
 * once every so many of them, and one with fewer boundaries than that ran to its
 * end with the deadline long past and nobody to say so: the timer that would
 * have said it never got a turn either. Asked here, once, where the cost of
 * reading a clock is nothing against the run that just finished.
 */
function overran(engine: Engine, scope: CancelScope): unknown {
  const expiry = scope.expiry;
  if (!expiry || engine.clock.now() < expiry.at) return undefined;
  scope.cancel(expiry.raise());
  return scope.stopped();
}

const LEFT_RUNNING = "This ran out of the time it was given, and did not stop.";

async function withRetry(args: {
  engine: Engine;
  retry: RetrySpec;
  title: string;
  run: () => Promise<void>;
}): Promise<void> {
  const total = args.retry.attempts + 1;
  for (let i = 1; i <= total; i++) {
    const snapshot = { ...args.engine.result };
    const outcome = await attempt(args.engine, args.run);
    if (outcome.ok) return;
    if (i >= total) {
      if (outcome.error) throw outcome.error;
      return;
    }
    Object.assign(args.engine.result, snapshot);
    emitRetrying({ engine: args.engine, title: args.title, attempt: i });
    await backoffPause(args.engine, backoff(args.retry, i));
  }
}

/**
 * The pause between attempts, which is cancellable like any other wait: a run
 * that has been called off must not sit here waiting to try again.
 */
async function backoffPause(engine: Engine, ms: number): Promise<void> {
  await engine.clock.sleep(ms, engine.cancel?.signal);
  checkpoint(engine);
}

interface AttemptOutcome {
  ok: boolean;
  error?: unknown;
}

async function attempt(engine: Engine, run: () => Promise<void>): Promise<AttemptOutcome> {
  const before = engine.result.failed;
  try {
    await run();
    return { ok: engine.result.failed === before };
  } catch (error) {
    if (isControlSignal(error)) throw error;
    return { ok: false, error };
  }
}

function emitRetrying(args: { engine: Engine; title: string; attempt: number }): void {
  args.engine.emitter.emit({
    kind: "flow.retrying",
    data: { title: args.title, attempt: args.attempt, reason: "previous attempt failed" },
  });
}

function backoff(retry: RetrySpec, attempt: number): number {
  return retry.backoffMs * retry.factor ** (attempt - 1);
}

function timeoutError(ms: number): VennError {
  return new VennError({ code: RUN_CODES.VN8001_TIMED_OUT, message: `Timed out after ${ms}ms.` });
}

import { VennError } from "@venn-lang/contracts";
import type { Annotation } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import { type RetrySpec, readRetry, readTimeout } from "./annotations.js";
import type { Engine } from "./engine.types.js";
import { isControlSignal } from "./signals.js";

interface AnnotatedNode {
  annotations: Annotation[];
}

/** Run a step/flow body applying its `@timeout` and `@retry` annotations. */
export async function runWithAnnotations(args: {
  engine: Engine;
  node: AnnotatedNode;
  scope: Scope;
  title: string;
  run: () => Promise<void>;
}): Promise<void> {
  const timeout = readTimeout(args.node);
  const retry = readRetry(args.node);
  const attempt = (): Promise<void> => withTimeout(timeout, args.run);
  if (!retry || retry.attempts === 0) return attempt();
  await withRetry({ engine: args.engine, retry, title: args.title, run: attempt });
}

/** Hold the named mutex (`@lock`/`@serial`) around `run`, releasing on exit. */
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

async function withTimeout(timeoutMs: number | undefined, run: () => Promise<void>): Promise<void> {
  if (timeoutMs === undefined) return run();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(timeoutError(timeoutMs)), timeoutMs);
  });
  try {
    await Promise.race([run(), guard]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
    await args.engine.clock.sleep(backoff(args.retry, i));
  }
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
  return new VennError({ code: "VN8001", message: `Timed out after ${ms}ms.` });
}

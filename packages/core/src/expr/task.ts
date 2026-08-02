import { type Method, nativeFn } from "./native.types.js";

/**
 * Exported so the member read can ask for it once rather than through a call
 * that re-asks whether the value is an object at all.
 */
export const TASK = Symbol("venn.task");

/**
 * Work already under way, held rather than waited for.
 *
 * Every call in Venn waits by itself, which is what makes `async` and `await`
 * unnecessary. `spawn` is how to opt out and start something without stopping
 * for it, the other half of the same feature.
 *
 * A task is deliberately not a promise. A promise handed to `let` would be
 * waited for by the statement, which is exactly what `spawn` exists to avoid,
 * so the promise is kept inside and `.wait` is how a reader asks for it back.
 */
export interface Task {
  readonly [TASK]: true;
  readonly promise: Promise<unknown>;
  settled: boolean;
  failed: boolean;
}

/** Whether this value is a running task. */
export function isTask(value: unknown): value is Task {
  return typeof value === "object" && value !== null && TASK in value;
}

/**
 * Start work and hand back a handle to it.
 *
 * The work begins on the next microtask, and the handle observes the promise
 * straight away, so a task nobody waits for cannot raise an unhandled
 * rejection.
 */
export function startTask(run: () => unknown): Task {
  const task: Task = {
    [TASK]: true,
    promise: Promise.resolve().then(run),
    settled: false,
    failed: false,
  };
  void task.promise.then(
    () => {
      task.settled = true;
    },
    () => {
      task.settled = true;
      task.failed = true;
    },
  );
  return task;
}

/**
 * What a task answers to.
 *
 * `.wait` gives back the promise and the statement that binds it does the
 * waiting, which is the same rule as everywhere else.
 */
export const TASK_METHODS: Record<string, Method> = {
  wait: (task: Task) => task.promise,
  done: (task: Task) => task.settled,
  failed: (task: Task) => task.failed,
  // Failure is the caller's to handle: a task nobody waits for must not take
  // the process down with an unhandled rejection.
  settle: (task: Task) => nativeFn(() => task.promise.then(ok, () => undefined)),
};

function ok(value: unknown): unknown {
  return value;
}

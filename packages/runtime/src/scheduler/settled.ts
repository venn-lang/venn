/**
 * Whether evaluating an expression produced something still running.
 *
 * Expressions compile synchronously, so a plugin verb called from inside one
 * hands back the promise it is running on rather than its result. Statement
 * position is already asynchronous, so it can wait, and `let id = newId()` binds
 * the id instead of `[object Promise]`.
 *
 * Callers branch on this rather than awaiting unconditionally: `await` on a
 * value that is not a promise still costs a turn of the event loop, and a
 * `forEach` over 50k items reads one expression per iteration.
 */
export function isPending(value: unknown): value is Promise<unknown> {
  return value instanceof Promise;
}

/** Wait for a value only if there is something to wait for. */
export async function settle<T>(value: T | Promise<T>): Promise<T> {
  return isPending(value) ? ((await value) as T) : (value as T);
}

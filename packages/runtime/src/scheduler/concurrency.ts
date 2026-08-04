import type { Pool } from "./concurrency.types.js";

/**
 * Run `task` over `items` with at most `limit` in flight at once.
 *
 * The pool does not outlive itself. A task that throws stops the cursor, and
 * the failure is raised only once every worker has settled, so a run that has
 * already failed is not still handing out work: `Promise.all` on its own
 * rejects at the first failure and leaves the rest dispatching, which is how a
 * caught failure was followed by four more items.
 *
 * @param pool The items, the limit, the work, and what ends it early.
 * @throws Whatever the first failing task threw, after the others have settled.
 */
export async function runPool<T>(pool: Pool<T>): Promise<void> {
  const state: PoolState = { cursor: 0, failure: undefined, failed: false };
  const size = Math.min(Math.max(1, pool.limit), pool.items.length);
  await Promise.all(Array.from({ length: size }, () => worker(pool, state)));
  if (state.failed) throw state.failure;
}

/** The cursor every worker shares, and the first failure any of them saw. */
interface PoolState {
  cursor: number;
  failure: unknown;
  failed: boolean;
}

/** One worker, taking the next index until the pool is done or has stopped. */
async function worker<T>(pool: Pool<T>, state: PoolState): Promise<void> {
  while (state.cursor < pool.items.length && !state.failed && !pool.stop?.()) {
    const index = state.cursor++;
    try {
      await pool.task(pool.items[index] as T, index);
    } catch (error) {
      state.failure = error;
      state.failed = true;
    }
  }
}

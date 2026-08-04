import type { Pool } from "./concurrency.types.js";

/**
 * Run `task` over `items` with at most `limit` in flight at once.
 *
 * @param pool The items, the limit, the work, and what ends it early.
 */
export async function runPool<T>(pool: Pool<T>): Promise<void> {
  const size = Math.max(1, pool.limit);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < pool.items.length && !pool.stop?.()) {
      const index = cursor++;
      await pool.task(pool.items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, pool.items.length) }, worker));
}

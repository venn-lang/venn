/** Run `task` over `items` with at most `limit` in flight at once. */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const size = Math.max(1, limit);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      await task(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

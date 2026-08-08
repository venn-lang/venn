/** How a per-item method answers, once every callback result has arrived. */
export type Decide = (list: readonly unknown[], results: readonly unknown[]) => unknown;

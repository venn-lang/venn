import { createTestHost } from "./create-test-host.js";
import { createWorkerHost } from "./create-worker-host.js";

/**
 * The neutral host assemblers.
 *
 * `node` is deliberately absent: it pulls `node:*`, so it lives behind
 * `@venn/contracts/node` as `createNodeHost` and this entry stays Worker-safe.
 */
export const createHost: {
  readonly worker: typeof createWorkerHost;
  readonly test: typeof createTestHost;
} = {
  worker: createWorkerHost,
  test: createTestHost,
};

import { ALL_CAPABILITIES } from "../capabilities/index.js";
import { createMemoryLogger } from "../logger/index.js";
import { createVirtualClock } from "../ports/clock/index.js";
import { createMemoryFs } from "../ports/file-system/index.js";
import { createInProcessLock } from "../ports/lock-provider/index.js";
import { createFakeProcess } from "../ports/process-provider/index.js";
import { createSeededRandom } from "../ports/random/index.js";
import { createMemorySecrets } from "../ports/secret-provider/index.js";
import type { Host } from "./host.types.js";

/**
 * A host of doubles, every capability granted. The default for tests.
 *
 * @param overrides - replaces individual members, e.g. a real clock.
 */
export function createTestHost(overrides: Partial<Host> = {}): Host {
  return {
    fs: createMemoryFs(),
    proc: createFakeProcess(),
    clock: createVirtualClock(),
    random: createSeededRandom({ seed: 1 }),
    secrets: createMemorySecrets({ values: {} }),
    log: createMemoryLogger(),
    lock: createInProcessLock(),
    caps: ALL_CAPABILITIES,
    ...overrides,
  };
}

import { createMemoryLogger } from "../logger/index.js";
import { createSystemClock } from "../ports/clock/index.js";
import { createMemoryFs } from "../ports/file-system/index.js";
import { createInProcessLock } from "../ports/lock-provider/index.js";
import { createPosixPaths } from "../ports/paths/index.js";
import type { ProcessProvider } from "../ports/process-provider/index.js";
import { createSeededRandom } from "../ports/random/index.js";
import { createMemorySecrets } from "../ports/secret-provider/index.js";
import type { Host } from "./host.types.js";
import { unavailable } from "./unavailable.js";

/**
 * Host for a Web Worker: an in-memory file system, no `process`, no `net`.
 *
 * `proc` is a stand-in whose every method throws VN2012, so reaching for a
 * subprocess in the editor fails with a diagnostic instead of a `TypeError`.
 */
export function createWorkerHost(): Host {
  return {
    fs: createMemoryFs(),
    paths: createPosixPaths(),
    // `spawn` written out, not read off a port descriptor: nothing binds or
    // negotiates a process port, and the list this needs is the one method a
    // `ProcessProvider` has.
    proc: unavailable<ProcessProvider>({ capability: "process", methods: ["spawn"] }),
    clock: createSystemClock(),
    random: createSeededRandom({ seed: 1 }),
    secrets: createMemorySecrets({ values: {} }),
    log: createMemoryLogger(),
    lock: createInProcessLock(),
    caps: ["fs", "clock", "random", "secrets", "log"],
  };
}

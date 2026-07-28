import { ALL_CAPABILITIES } from "../capabilities/index.js";
import { createConsoleLogger } from "../logger/index.js";
import { createSystemClock } from "../ports/clock/index.js";
import { createNodeFs } from "../ports/file-system/node-fs.js";
import { createInProcessLock } from "../ports/lock-provider/index.js";
import { createNodeSpawn } from "../ports/process-provider/node-spawn.js";
import { createSeededRandom } from "../ports/random/index.js";
import { createEnvSecrets } from "../ports/secret-provider/index.js";
import type { Host } from "./host.types.js";

/**
 * Host for the CLI: the real file system, secrets from the environment, and
 * every capability.
 *
 * @param args.root - where relative paths resolve. Defaults to the process's
 * current directory.
 */
export function createNodeHost(args: { root?: string } = {}): Host {
  return {
    fs: createNodeFs({ root: args.root }),
    proc: createNodeSpawn(),
    clock: createSystemClock(),
    random: createSeededRandom({ seed: 1 }),
    secrets: createEnvSecrets(),
    log: createConsoleLogger(),
    lock: createInProcessLock(),
    caps: ALL_CAPABILITIES,
  };
}

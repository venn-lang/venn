import { ALL_CAPABILITIES } from "../capabilities/index.js";
import { createConsoleLogger } from "../logger/index.js";
import { createSystemClock } from "../ports/clock/index.js";
import { createNodeFs } from "../ports/file-system/node-fs.js";
import { createInProcessLock } from "../ports/lock-provider/index.js";
import { createPosixPaths, createWindowsPaths, type Paths } from "../ports/paths/index.js";
import { createNodeSpawn } from "../ports/process-provider/node-spawn.js";
import { createSeededRandom } from "../ports/random/index.js";
import { createEnvSecrets } from "../ports/secret-provider/index.js";
import type { Host } from "./host.types.js";

/** What a run draws from when nobody asked for another. */
const DEFAULT_SEED = 1;

/**
 * Host for the CLI: the real file system, secrets from the environment, and
 * every capability.
 *
 * @param args.root - where relative paths resolve. Defaults to the process's
 * current directory.
 * @param args.seed - what the run's randomness starts from. Recording it and
 * passing it back is what replays a run: `--seed` is this argument.
 */
export function createNodeHost(args: { root?: string; seed?: number } = {}): Host {
  return {
    fs: createNodeFs({ root: args.root }),
    paths: hostPaths(args.root ?? process.cwd()),
    proc: createNodeSpawn(),
    clock: createSystemClock(),
    random: createSeededRandom({ seed: args.seed ?? DEFAULT_SEED }),
    secrets: createEnvSecrets(),
    log: createConsoleLogger(),
    lock: createInProcessLock(),
    caps: ALL_CAPABILITIES,
  };
}

/**
 * The spelling this machine uses, which is the one thing about a path a program
 * must never decide for itself.
 */
function hostPaths(cwd: string): Paths {
  return process.platform === "win32" ? createWindowsPaths({ cwd }) : createPosixPaths({ cwd });
}

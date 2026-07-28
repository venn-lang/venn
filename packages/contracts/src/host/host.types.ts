import type { HostCapability } from "../capabilities/index.js";
import type { Logger } from "../logger/index.js";
import type { Clock } from "../ports/clock/index.js";
import type { FileSystem } from "../ports/file-system/index.js";
import type { LockProvider } from "../ports/lock-provider/index.js";
import type { ProcessProvider } from "../ports/process-provider/index.js";
import type { Random } from "../ports/random/index.js";
import type { SecretProvider } from "../ports/secret-provider/index.js";

/**
 * Everything the core is allowed to reach: assembled at the entry point, then
 * passed inward. The core receives this and imports nothing else.
 *
 * Three assemblers build one: `createHost.worker`, `createHost.test`, and
 * `createNodeHost` from `@venn-lang/contracts/node`.
 */
export interface Host {
  readonly fs: FileSystem;
  readonly proc: ProcessProvider;
  readonly clock: Clock;
  readonly random: Random;
  readonly secrets: SecretProvider;
  readonly log: Logger;
  readonly lock: LockProvider;
  readonly caps: readonly HostCapability[];
}

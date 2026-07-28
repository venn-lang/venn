import { VennError } from "@venn-lang/contracts";
import type { Notifier } from "../port/index.js";

/**
 * The live `Notifier`. No Slack, webhook or email wiring in this build.
 *
 * @returns a notifier whose `send` throws, so the gap is a legible failure
 * rather than a silent no-op.
 * @throws {VennError} `VN8090` on every `send`.
 */
export function createRealNotifier(): Notifier {
  return {
    send: async () => {
      throw new VennError({
        code: "VN8090",
        message: "Notifier real client not implemented in this build",
      });
    },
  };
}

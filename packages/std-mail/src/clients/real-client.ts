import { VennError } from "@venn-lang/contracts";
import type { MailClient } from "../port/index.js";

/**
 * The backend-talking `MailClient`. Not wired up in this build.
 *
 * @returns a client whose every method throws, so the gap is a legible failure
 * rather than an empty inbox that looks real.
 * @throws {VennError} `VN8090` on any call.
 */
export function createRealMailClient(): MailClient {
  return {
    selectInbox: () => notImplemented(),
    waitFor: () => notImplemented(),
    read: () => notImplemented(),
    attachments: () => notImplemented(),
    clear: () => notImplemented(),
  };
}

function notImplemented(): never {
  throw new VennError({
    code: "VN8090",
    message: "Mail real client not implemented in this build",
  });
}

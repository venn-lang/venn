import { VennError } from "@venn-lang/contracts";
import { PLUGIN_CODES } from "@venn-lang/sdk";
import type { WsClient } from "../port/index.js";

/**
 * The real WebSocket client. Not implemented in this build.
 *
 * It exists so the port has its second implementation and the failure is a named
 * Venn error rather than a missing method.
 *
 * @throws VN8090 from every method.
 */
export function createRealWsClient(): WsClient {
  return {
    connect: notImplemented,
    send: notImplemented,
    expect: notImplemented,
    close: notImplemented,
  };
}

function notImplemented(): never {
  throw new VennError({
    code: PLUGIN_CODES.VN8090_NOT_BUILT,
    message: "WebSocket real client not implemented in this build",
  });
}

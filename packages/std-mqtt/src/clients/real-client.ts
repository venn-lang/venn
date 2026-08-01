import { VennError } from "@venn-lang/contracts";
import { PLUGIN_CODES } from "@venn-lang/sdk";
import type { MqttClient } from "../port/index.js";

/**
 * The real MQTT client. Not implemented in this build.
 *
 * It exists so the port has its second implementation and the failure is a named
 * Venn error rather than a missing method.
 *
 * @throws VN8090 from every method.
 */
export function createRealMqttClient(): MqttClient {
  return {
    connect: notImplemented,
    publish: notImplemented,
    subscribe: notImplemented,
    expect: notImplemented,
  };
}

function notImplemented(): never {
  throw new VennError({
    code: PLUGIN_CODES.VN8090_NOT_BUILT,
    message: "MQTT real client not implemented in this build",
  });
}

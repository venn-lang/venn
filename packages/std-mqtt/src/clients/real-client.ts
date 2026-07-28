import { VennError } from "@venn/contracts";
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
    code: "VN8090",
    message: "MQTT real client not implemented in this build",
  });
}

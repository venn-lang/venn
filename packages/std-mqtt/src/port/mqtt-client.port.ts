import type { Port } from "@venn/contracts";
import type { MqttClient } from "./mqtt-client.types.js";

/**
 * The port descriptor every `mqtt` verb resolves through `ctx.port(...)`.
 *
 * Declares the `net` capability, so a host that cannot reach a broker refuses
 * the binding at load time with a readable diagnostic.
 */
export const MqttClientPort: Port<MqttClient> = {
  id: "venn.port.mqtt-client",
  version: 1,
  requires: ["net"],
  methods: ["connect", "publish", "subscribe", "expect"],
};

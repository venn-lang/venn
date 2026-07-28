import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { MqttClientPort } from "../port/index.js";

/**
 * `mqtt.connect "mqtt://broker.test"`: open the broker connection.
 *
 * Returns nothing, because the port owns the connection. That is what lets the
 * other verbs reach it without the flow carrying a handle.
 */
export const mqttConnect: ActionDefinition = defineAction({
  name: "connect",
  doc: "Connect to an MQTT broker.",
  args: [arg("url", t.string, "Where the broker is.")],
  result: t.void,
  run: (ctx, input) => ctx.port(MqttClientPort).connect({ broker: String(input.args[0] ?? "") }),
});

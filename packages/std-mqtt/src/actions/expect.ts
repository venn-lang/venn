import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { MqttClientPort } from "../port/index.js";

/**
 * `mqtt.expect "inventory/ack"`: wait for the next message on a topic.
 *
 * The result is typed as `mqtt.Message`, which is what lets
 * `expect res topic "inventory/ack"` know its subject.
 */
export const mqttExpect: ActionDefinition = defineAction({
  name: "expect",
  doc: "Wait for the next message on a topic.",
  args: [arg("topic", t.string, "The topic, wildcards and all.")],
  result: t.ref("mqtt.Message"),
  run: (ctx, input) => ctx.port(MqttClientPort).expect({ topic: String(input.args[0] ?? "") }),
});

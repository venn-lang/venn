import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { MqttClientPort } from "../port/index.js";

/**
 * `mqtt.subscribe "inventory/#"`: start receiving on a topic.
 *
 * Returns nothing: the port remembers the subscription, and `mqtt.expect` is how
 * a flow reaches what arrived.
 */
export const mqttSubscribe: ActionDefinition = defineAction({
  name: "subscribe",
  doc: "Subscribe to a topic.",
  args: [arg("topic", t.string, "The topic, wildcards and all.")],
  result: t.void,
  run: (ctx, input) => ctx.port(MqttClientPort).subscribe({ topic: String(input.args[0] ?? "") }),
});

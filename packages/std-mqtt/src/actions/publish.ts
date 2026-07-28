import { type ActionDefinition, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { MqttClientPort } from "../port/index.js";

const params = z.object({
  json: z.unknown().optional(),
  qos: z.number().optional(),
  retain: z.boolean().optional(),
  will: z.unknown().optional(),
});

/**
 * `mqtt.publish "inventory/sku-42" { json: { … }, qos: 1 }`: send one message.
 *
 * The topic is the only positional argument; the payload and the delivery
 * options ride the map, which `params` above describes.
 */
export const mqttPublish: ActionDefinition = defineAction({
  name: "publish",
  doc: "Publish a message to a topic.",
  params,
  args: [arg("topic", t.string, "The topic, wildcards and all.")],
  result: t.void,
  run: (ctx, input) =>
    ctx.port(MqttClientPort).publish({
      topic: String(input.args[0] ?? ""),
      payload: input.params.json,
      qos: input.params.qos,
      retain: input.params.retain,
      will: input.params.will,
    }),
});

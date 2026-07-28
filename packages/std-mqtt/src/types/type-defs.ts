import { type TypeSpec, t } from "@venn/types";

/**
 * The types the plugin publishes to flows, as `mqtt.Message`.
 *
 * Mirrors `MqttMessage` in `message.types.ts` and the Zod schema beside it: the
 * schema guards a value at runtime, this tells the checker what `mqtt.expect`
 * handed back. Keep the three in step by hand.
 */
export const mqttTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /** One message on a topic, as `mqtt.expect` gives it back. */
  Message: t.record(
    { topic: t.string, payload: t.dynamic, qos: t.number, retain: t.bool },
    { optional: ["qos", "retain"] },
  ),
};

import { describe, expect, it } from "vitest";
import type { MqttClient } from "../port/index.js";

/** One MqttClient implementation to run the contract against. */
export interface MqttClientSpec {
  name: string;
  make(): MqttClient;
}

/** The MqttClient conformance suite: the contract every implementation owes. */
export function mqttClientConformance(spec: MqttClientSpec): void {
  describe(`MqttClient · ${spec.name}`, () => {
    it("connect resolves", async () => {
      await expect(spec.make().connect({ broker: "mqtt://example.test" })).resolves.toBeUndefined();
    });
    it("subscribe resolves", async () => {
      await expect(spec.make().subscribe({ topic: "inventory/ack" })).resolves.toBeUndefined();
    });
    it("publish then expect returns the payload on that topic", async () => {
      const client = spec.make();
      await client.publish({ topic: "inventory/ack", payload: { ok: true } });
      const message = await client.expect({ topic: "inventory/ack" });
      expect(message.payload).toEqual({ ok: true });
    });
  });
}

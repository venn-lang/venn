import { VennError } from "@venn-lang/contracts";
import { expect, it } from "vitest";
import { createFakeMqttClient } from "./fake-client.js";
import { mqttClientConformance } from "./mqtt-client.suite.js";
import { createRealMqttClient } from "./real-client.js";

mqttClientConformance({ name: "fake", make: () => createFakeMqttClient() });

it("publish records qos/retain/last-will opts", async () => {
  const client = createFakeMqttClient();
  await client.publish({
    topic: "inventory/sku-42",
    payload: { n: 42 },
    qos: 1,
    retain: true,
    will: { bye: true },
  });
  expect(client.published).toHaveLength(1);
  expect(client.published[0]).toMatchObject({
    topic: "inventory/sku-42",
    qos: 1,
    retain: true,
    will: { bye: true },
  });
});

it("subscribe records the subscription", async () => {
  const client = createFakeMqttClient();
  await client.subscribe({ topic: "inventory/ack" });
  expect(client.subscriptions).toContain("inventory/ack");
});

it("expect returns the next message published on the topic", async () => {
  const client = createFakeMqttClient();
  await client.publish({ topic: "inventory/ack", payload: "ok" });
  expect((await client.expect({ topic: "inventory/ack" })).payload).toBe("ok");
});

it("expect rejects with VN8091 when the topic is empty", async () => {
  await expect(createFakeMqttClient().expect({ topic: "empty" })).rejects.toMatchObject({
    code: "VN8091",
  });
});

it("real client throws VN8090", () => {
  let error: unknown;
  try {
    createRealMqttClient().connect({ broker: "mqtt://x" });
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(VennError);
  expect((error as VennError).code).toBe("VN8090");
});

import { VennError } from "@venn-lang/contracts";
import type { FakeMqttClient, MqttPublishArgs } from "../port/index.js";
import type { MqttMessage } from "../types/index.js";

/**
 * The double: a queue per topic, and no broker.
 *
 * A publish is also a delivery, so a flow that publishes and then expects on the
 * same topic sees its own message. Topics are matched literally, with no
 * wildcard expansion.
 *
 * @param args.seed Messages already waiting, keyed by topic.
 * @returns A client whose `published` and `subscriptions` a test can read back.
 * @throws VN8091 from `expect` when that topic's queue is empty.
 */
export function createFakeMqttClient(
  args: { seed?: Record<string, MqttMessage[]> } = {},
): FakeMqttClient {
  const topics = seedTopics(args.seed);
  const published: MqttPublishArgs[] = [];
  const subscriptions: string[] = [];
  return {
    published,
    subscriptions,
    connect: async () => {},
    publish: async (call) => recordPublish({ topics, published, call }),
    subscribe: async ({ topic }) => void subscriptions.push(topic),
    expect: async ({ topic }) => dequeue(topics, topic),
  };
}

function recordPublish(args: {
  topics: Map<string, MqttMessage[]>;
  published: MqttPublishArgs[];
  call: MqttPublishArgs;
}): void {
  args.published.push(args.call);
  enqueue(args.topics, toMessage(args.call));
}

function toMessage(call: MqttPublishArgs): MqttMessage {
  return { topic: call.topic, payload: call.payload, qos: call.qos, retain: call.retain };
}

function enqueue(topics: Map<string, MqttMessage[]>, message: MqttMessage): void {
  const queue = topics.get(message.topic) ?? [];
  queue.push(message);
  topics.set(message.topic, queue);
}

function dequeue(topics: Map<string, MqttMessage[]>, topic: string): MqttMessage {
  const message = topics.get(topic)?.shift();
  if (!message) throw noMessage(topic);
  return message;
}

function seedTopics(seed: Record<string, MqttMessage[]> = {}): Map<string, MqttMessage[]> {
  return new Map(Object.entries(seed).map(([topic, messages]) => [topic, [...messages]]));
}

function noMessage(topic: string): VennError {
  return new VennError({
    code: "VN8091",
    message: `No message available on topic "${topic}".`,
    detail: { topic },
  });
}

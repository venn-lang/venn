import type { MqttMessage } from "../types/index.js";

/** What `mqtt.publish` passes on: the topic it was given, plus the opts map. */
export interface MqttPublishArgs {
  topic: string;
  payload: unknown;
  qos?: number;
  retain?: boolean;
  /** Last-will payload, stored alongside the publish. */
  will?: unknown;
}

/**
 * One broker connection: connect, publish, subscribe, and wait for a message.
 *
 * The port holds the connection, which is why no method takes a handle: a flow
 * says `mqtt.publish "topic"` and the implementation knows which broker.
 *
 * Two implementations: `createRealMqttClient` and `createFakeMqttClient`.
 */
export interface MqttClient {
  connect(args: { broker: string }): Promise<void>;
  publish(args: MqttPublishArgs): Promise<void>;
  subscribe(args: { topic: string }): Promise<void>;
  expect(args: { topic: string }): Promise<MqttMessage>;
}

/** An `MqttClient` that also lets a test read back what the flow asked for. */
export interface FakeMqttClient extends MqttClient {
  /** Every publish call, in order, including qos/retain/will. */
  readonly published: readonly MqttPublishArgs[];
  /** Every subscribed topic, in order. */
  readonly subscriptions: readonly string[];
}

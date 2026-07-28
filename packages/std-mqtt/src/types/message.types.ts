/** One message delivered on a topic, and what `mqtt.expect` hands back. */
export interface MqttMessage {
  topic: string;
  payload: unknown;
  qos?: number;
  retain?: boolean;
}

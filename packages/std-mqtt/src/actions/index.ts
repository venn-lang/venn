import type { ActionDefinition } from "@venn/sdk";
import { mqttConnect } from "./connect.js";
import { mqttExpect } from "./expect.js";
import { mqttPublish } from "./publish.js";
import { mqttSubscribe } from "./subscribe.js";

/** The mqtt namespace's verbs. Adding one is a new file plus a single line here. */
export const mqttActions: ActionDefinition[] = [
  mqttConnect,
  mqttPublish,
  mqttSubscribe,
  mqttExpect,
];

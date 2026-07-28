import type { MatcherDefinition } from "@venn/sdk";
import { onTopic } from "./on-topic.js";

export const mqttMatchers: MatcherDefinition[] = [onTopic];

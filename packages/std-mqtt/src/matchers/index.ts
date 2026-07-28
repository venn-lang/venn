import type { MatcherDefinition } from "@venn-lang/sdk";
import { onTopic } from "./on-topic.js";

export const mqttMatchers: MatcherDefinition[] = [onTopic];

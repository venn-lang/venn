import type { ActionDefinition } from "@venn/sdk";
import { email } from "./email.js";
import { slack } from "./slack.js";
import { webhook } from "./webhook.js";

/** Every verb in the `notify` namespace, in the order the plugin registers them. */
export const notifyActions: ActionDefinition[] = [slack, webhook, email];

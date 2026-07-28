import type { ActionDefinition } from "@venn-lang/sdk";
import { attachmentsAction } from "./attachments.js";
import { clearAction } from "./clear.js";
import { inboxAction } from "./inbox.js";
import { readAction } from "./read.js";
import { waitForAction } from "./wait-for.js";

/** Every verb in the `mail` namespace, in the order the plugin registers them. */
export const mailActions: ActionDefinition[] = [
  inboxAction,
  waitForAction,
  readAction,
  attachmentsAction,
  clearAction,
];

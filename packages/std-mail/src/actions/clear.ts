import { type ActionDefinition, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import { MailClientPort } from "../port/index.js";

/**
 * `mail.clear`.
 *
 * Empties the selected inbox and drops the current email. Use it between flows
 * so one run's mail cannot satisfy the next one's `mail.waitFor`.
 */
export const clearAction: ActionDefinition = defineAction({
  name: "clear",
  doc: "Empty the selected inbox.",
  result: t.void,
  run: (ctx) => ctx.port(MailClientPort).clear(),
});

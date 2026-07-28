import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { MailClientPort } from "../port/index.js";

/**
 * `mail.inbox "mailpit"`.
 *
 * Points every later `mail` verb at one inbox. Call it before `mail.waitFor`.
 *
 * The name is echoed back so a flow can bind it and read later which inbox it
 * is on.
 *
 * @returns the selected inbox name.
 */
export const inboxAction: ActionDefinition = defineAction({
  name: "inbox",
  doc: "Select the mail backend/inbox to operate on.",
  args: [arg("name", t.string, "Which inbox to work with from here on.")],
  result: t.string,
  run: async (ctx, input) => {
    const name = String(input.args[0] ?? "");
    await ctx.port(MailClientPort).selectInbox(name);
    return name;
  },
});

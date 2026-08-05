import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { mailActions } from "./actions/index.js";
import { mailTypeDefs } from "./types/index.js";

/**
 * The `@venn-lang/mail` plugin. Registers the `mail` namespace: the `inbox`,
 * `waitFor`, `read`, `attachments` and `clear` verbs, and the nominal
 * `mail.Email` and `mail.Attachment` types. Requires the `net` capability.
 */
export const mailPlugin: PluginDefinition = definePlugin({
  name: "venn/mail",
  namespace: "mail",
  requires: ["net"],
  actions: mailActions,
  typeDefs: mailTypeDefs,
});

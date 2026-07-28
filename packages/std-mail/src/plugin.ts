import { definePlugin, type PluginDefinition } from "@venn/sdk";
import { mailActions } from "./actions/index.js";
import { AttachmentSchema, EmailSchema, mailTypeDefs } from "./types/index.js";

/**
 * The `@venn/mail` plugin. Registers the `mail` namespace: the `inbox`,
 * `waitFor`, `read`, `attachments` and `clear` verbs, and the nominal
 * `mail.Email` and `mail.Attachment` types. Requires the `net` capability.
 */
export const mailPlugin: PluginDefinition = definePlugin({
  name: "@venn/mail",
  version: "0.0.0",
  namespace: "mail",
  requires: ["net"],
  actions: mailActions,
  types: { Email: EmailSchema, Attachment: AttachmentSchema },
  typeDefs: mailTypeDefs,
});

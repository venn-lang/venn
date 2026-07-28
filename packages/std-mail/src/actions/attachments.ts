import { type ActionDefinition, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import { MailClientPort } from "../port/index.js";

/**
 * `mail.attachments`.
 *
 * Lists what the email `mail.waitFor` last matched carries. Metadata only: the
 * bytes stay at the backend.
 *
 * @returns a list of `mail.Attachment`, empty when the email carries none.
 * @throws {VennError} `VN7090` when no email is selected yet.
 */
export const attachmentsAction: ActionDefinition = defineAction({
  name: "attachments",
  doc: "Return the current email's attachments.",
  result: t.list(t.ref("mail.Attachment")),
  run: (ctx) => ctx.port(MailClientPort).attachments(),
});

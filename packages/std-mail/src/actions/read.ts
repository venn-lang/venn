import { type ActionDefinition, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { MailClientPort } from "../port/index.js";

/**
 * `mail.read`.
 *
 * Gives back the body of the email `mail.waitFor` last matched.
 *
 * @returns the body as text.
 * @throws {VennError} `VN7090` when no email is selected yet.
 */
export const readAction: ActionDefinition = defineAction({
  name: "read",
  doc: "Read the current email's body.",
  result: t.string,
  run: (ctx) => ctx.port(MailClientPort).read(),
});

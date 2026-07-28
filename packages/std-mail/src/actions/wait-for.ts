import { type ActionDefinition, Duration, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { MailClientPort } from "../port/index.js";

const waitForParams = z.object({
  to: z.string().optional(),
  subject: z.string().optional(),
  within: Duration.optional(),
});

/**
 * `mail.waitFor { to: "ada@example.test", subject: "verification", within: "30s" }`.
 *
 * Blocks until an email arrives in the selected inbox that matches every given
 * filter. `to` matches exactly, `subject` matches as a substring, and `within`
 * bounds the wait. Omitting a filter matches anything. The match becomes the
 * current email that `mail.read` and `mail.attachments` then work on.
 *
 * @returns the matching `mail.Email`.
 * @throws {VennError} `VN8091` when no email matches.
 */
export const waitForAction: ActionDefinition = defineAction({
  name: "waitFor",
  doc: "Wait for the first email matching to/subject (subject matches as a substring).",
  params: waitForParams,
  result: t.ref("mail.Email"),
  run: (ctx, input) => ctx.port(MailClientPort).waitFor(input.params),
});

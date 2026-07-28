import { type ActionDefinition, arg, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { NotifierPort } from "../port/index.js";

const params = z
  .object({
    subject: z.string().optional(),
    body: z.string().optional(),
  })
  .optional();

/**
 * `notify.email "qa@example.com" { subject: "Nightly failed", body: report }`.
 *
 * Sends one email. Both `subject` and `body` are optional; an empty recipient
 * is passed straight through to the notifier, which decides what to do with it.
 *
 * @returns a `notify.Receipt`.
 */
export const email: ActionDefinition = defineAction({
  name: "email",
  doc: "Send an email notification.",
  params,
  args: [arg("to", t.string, "Who receives it.")],
  result: t.ref("notify.Receipt"),
  run: (ctx, input) =>
    ctx.port(NotifierPort).send({
      kind: "email",
      channel: String(input.args[0] ?? ""),
      subject: input.params?.subject,
      body: input.params?.body,
    }),
});

import { type TypeSpec, t } from "@venn-lang/types";

/**
 * The types `@venn-lang/mail` publishes to the checker, under the `mail` namespace.
 * Kept as data, and mirroring `email.types.ts` by hand, so a generator reading
 * the emitted `.d.ts` can replace this file unnoticed.
 */
export const mailTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /** One email, as `mail.waitFor` gives it back. */
  Email: t.record({
    to: t.string,
    subject: t.string,
    body: t.string,
    attachments: t.list(t.ref("mail.Attachment")),
  }),
  /** A file carried by an email. Metadata only: the bytes stay at the backend. */
  Attachment: t.record({ filename: t.string, contentType: t.string, size: t.number }),
};

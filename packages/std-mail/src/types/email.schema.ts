import { type ZodType, z } from "@venn-lang/sdk";
import type { Attachment, Email } from "./email.types.js";

/** Runtime validator for the nominal `mail.Attachment` type. */
export const AttachmentSchema: ZodType<Attachment> = z.object({
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
});

/** Runtime validator for the nominal `mail.Email` type. */
export const EmailSchema: ZodType<Email> = z.object({
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  attachments: z.array(AttachmentSchema),
});

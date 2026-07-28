/** A file carried by an {@link Email}. Metadata only: the bytes stay at the backend. */
export interface Attachment {
  filename: string;
  contentType: string;
  /** Size in bytes, as the backend reports it. */
  size: number;
}

/** One email, as `mail.waitFor` hands it back. */
export interface Email {
  to: string;
  subject: string;
  body: string;
  attachments: Attachment[];
}

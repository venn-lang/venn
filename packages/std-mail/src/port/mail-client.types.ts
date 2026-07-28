import type { Attachment, Email } from "../types/index.js";

/** What {@link MailClient.waitFor} looks for. An omitted field matches anything. */
export interface MailQuery {
  /** Matched exactly against the recipient. */
  to?: string;
  /** Matched as a substring of the subject line. */
  subject?: string;
  /** How long to wait, in milliseconds. `Duration` parses "30s" into this. */
  within?: number;
}

/**
 * The contract every `mail` verb goes through.
 *
 * It is stateful by design: `selectInbox` fixes which inbox the rest address,
 * and `waitFor` fixes the current email that `read` and `attachments` then work
 * on. Order matters, and a call out of order fails rather than guessing.
 */
export interface MailClient {
  selectInbox(name: string): Promise<void>;
  /**
   * Waits for the first email matching `query` and makes it current.
   *
   * @throws {VennError} `VN8091` when nothing matches.
   */
  waitFor(query: MailQuery): Promise<Email>;
  /**
   * The current email's body.
   *
   * @throws {VennError} `VN7090` when no email is current.
   */
  read(): Promise<string>;
  /**
   * The current email's attachments, as metadata.
   *
   * @throws {VennError} `VN7090` when no email is current.
   */
  attachments(): Promise<Attachment[]>;
  /** Empties the selected inbox and clears the current email. */
  clear(): Promise<void>;
}

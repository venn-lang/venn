/** The kind of channel a notification targets. */
export type NotificationKind = "slack" | "webhook" | "email";

/**
 * One message handed to the `Notifier`. `kind` picks the channel type and
 * decides which of the optional fields carry meaning: `subject` and `body` for
 * email, `mention` for Slack, `json` for a webhook.
 */
export interface Notification {
  kind: NotificationKind;
  /** Where it goes, read in the terms of its `kind`: a Slack channel, a URL, an address. */
  channel: string;
  subject?: string;
  body?: string;
  mention?: string;
  json?: unknown;
}

/** What a `Notifier` answers with once a message is on its way. */
export interface NotifyReceipt {
  /** The dispatch succeeded. Says nothing about whether anyone read it. */
  delivered: boolean;
  /** The notifier's own handle for the message. */
  id: string;
}

/** The contract every notification goes through, whatever the channel. */
export interface Notifier {
  /**
   * Dispatches one message.
   *
   * @returns the receipt for the dispatch.
   * @throws {VennError} `VN8090` from an implementation that cannot deliver.
   */
  send(message: Notification): Promise<NotifyReceipt>;
}

/** A `Notifier` that keeps every sent notification in memory, for assertions. */
export interface FakeNotifier extends Notifier {
  readonly sent: readonly Notification[];
}

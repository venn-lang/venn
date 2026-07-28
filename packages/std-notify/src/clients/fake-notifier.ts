import type { FakeNotifier, Notification } from "../port/index.js";

/**
 * The in-memory `Notifier`. Records what it is handed and touches no network.
 *
 * @returns a fresh notifier whose `sent` array starts empty and grows in
 * dispatch order.
 */
export function createFakeNotifier(): FakeNotifier {
  const sent: Notification[] = [];
  return {
    sent,
    send: async (message) => {
      sent.push(message);
      return { delivered: true, id: `fake-${sent.length}` };
    },
  };
}

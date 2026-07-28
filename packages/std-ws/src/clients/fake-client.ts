import { VennError } from "@venn/contracts";
import type { FakeWsClient, WsExpectQuery } from "../port/index.js";
import type { Message } from "../types/index.js";

/**
 * The double: no socket, and `expect` resolves at once instead of waiting.
 *
 * @param args.incoming Messages the peer is pretending to have sent, in order.
 * @returns A client whose `sent` array is everything the flow wrote.
 * @throws VN8091 from `expect` once the incoming queue is empty.
 */
export function createFakeWsClient(args: { incoming?: Message[] } = {}): FakeWsClient {
  const incoming = [...(args.incoming ?? [])];
  const sent: Message[] = [];
  return {
    sent,
    connect: async () => {},
    send: async (message) => void sent.push(message),
    expect: async (query) => takeMatch(incoming, query),
    close: async () => {},
  };
}

/**
 * Consume the first message matching `query`, or the head of the queue when
 * none match, so a mistyped query still advances instead of deadlocking.
 */
function takeMatch(queue: Message[], query: WsExpectQuery): Message {
  const index = queue.findIndex((message) => matches(message, query));
  const found = queue.splice(index >= 0 ? index : 0, 1)[0];
  if (!found) throw noMessage();
  return found;
}

function matches(message: Message, query: WsExpectQuery): boolean {
  if (query.type !== undefined) return message.type === query.type;
  if (query.where) return matchesWhere(message, query.where);
  return true;
}

function matchesWhere(message: Message, where: Record<string, unknown>): boolean {
  const record = message as Record<string, unknown>;
  return Object.entries(where).every(([key, value]) => equal(record[key], value));
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function noMessage(): VennError {
  return new VennError({ code: "VN8091", message: "No WebSocket message available to match." });
}

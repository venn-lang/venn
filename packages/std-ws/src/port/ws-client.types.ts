import type { Message } from "../types/index.js";

/** What `ws.connect` passes on: the URL it was given, and any `auth` from the opts map. */
export interface WsConnectArgs {
  url: string;
  auth?: unknown;
}

/**
 * Which incoming message `ws.expect` is waiting for: one with this `type`, or
 * one whose fields match every entry in `where`. Both empty means the next one.
 */
export interface WsExpectQuery {
  type?: string;
  where?: Record<string, unknown>;
}

/**
 * One WebSocket connection: open it, write to it, wait on it, close it.
 *
 * The port holds the socket, which is why no method takes a handle: a flow says
 * `ws.send { … }` and the implementation knows which connection it means.
 *
 * Two implementations: `createRealWsClient` and `createFakeWsClient`.
 */
export interface WsClient {
  connect(args: WsConnectArgs): Promise<void>;
  send(message: Message): Promise<void>;
  expect(query: WsExpectQuery): Promise<Message>;
  close(): Promise<void>;
}

/** A `WsClient` that also lets a test read back what the flow sent. */
export interface FakeWsClient extends WsClient {
  /** Every message handed to `send`, in order. */
  readonly sent: readonly Message[];
}

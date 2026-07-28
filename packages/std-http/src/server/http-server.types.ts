/** One request a server received, as the language sees it. */
export interface ServerRequest {
  method: string;
  /** The path with its query string, exactly as it arrived. */
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** What a handler answers with. Every field has a sensible default. */
export interface ServerReply {
  status?: number;
  headers?: Record<string, string>;
  /** A string is sent as-is; anything else is sent as JSON. */
  body?: unknown;
}

/** Called once per request. Returning nothing sends `204 No Content`. */
export type RequestHandler = (
  request: ServerRequest,
) => ServerReply | undefined | Promise<ServerReply | undefined>;

/** A server that is listening, and how to stop it. */
export interface RunningServer {
  /** The port it actually bound to. Asking for 0 gets one chosen for you. */
  readonly port: number;
  close(): Promise<void>;
}

/**
 * Accepting requests over HTTP.
 *
 * Two implementations: `createNodeServer` binds a real socket, and
 * `createMemoryServer` keeps the handler in memory so a test can deliver a
 * request without a network. The conformance suite is what says they agree.
 */
export interface HttpServer {
  listen(args: { port: number; host?: string; handle: RequestHandler }): Promise<RunningServer>;
}

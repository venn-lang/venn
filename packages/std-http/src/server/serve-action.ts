import { type ActionDefinition, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { HttpServerPort } from "./http-server.port.js";
import type { ServerReply, ServerRequest } from "./http-server.types.js";

const serveParams = z.object({
  port: z.number().optional().describe("Which port to bind. 0 asks for any free one."),
  host: z.string().optional().describe("Which interface to bind. Defaults to 127.0.0.1."),
});

/**
 * The value `http.serve` hands back, seen by flows as `http.Server`.
 *
 * A server is not a request-response verb: it stays, and the requests arrive
 * afterwards. So the verb returns something the program holds on to: the port it
 * got, and what it may do with it.
 */
export interface ServeHandle {
  kind: "http-server";
  port: number;
  /** Deliver one request to whatever `handle` was last given. Used by tests. */
  deliver: (request: Partial<ServerRequest>) => Promise<ServerReply>;
  close: () => Promise<void>;
  /** Replace the handler. `http.on` is how a flow reaches this. */
  onRequest: (handle: (request: ServerRequest) => unknown) => void;
}

/**
 * `let api = http.serve { port: 8080 }`: start listening.
 *
 * The handler starts as a 404 and `http.on` replaces it, so a request arriving
 * before the flow has said what to do with it gets an answer instead of hanging.
 */
export function serveAction(): ActionDefinition {
  return defineAction({
    name: "serve",
    doc: "Start an HTTP server and hand back a handle. `http.on` says what to answer.",
    params: serveParams.optional(),
    result: t.ref("http.Server"),
    run: async (ctx, input) => {
      const params = (input.params ?? {}) as { port?: number; host?: string };
      const state: HandlerState = { handle: notFound };
      const running = await ctx.port(HttpServerPort).listen({
        port: params.port ?? 0,
        host: params.host,
        handle: (request: ServerRequest) => state.handle(request),
      });
      return handle(running, state);
    },
  });
}

interface HandlerState {
  handle: (request: ServerRequest) => ServerReply | Promise<ServerReply>;
}

function handle(
  running: { port: number; close: () => Promise<void> },
  state: HandlerState,
): ServeHandle {
  return {
    kind: "http-server",
    port: running.port,
    close: () => running.close(),
    deliver: async (request) => state.handle(fill(request)),
    onRequest: (given) => {
      state.handle = async (request) => asReply(await given(request));
    },
  };
}

/**
 * Whatever the flow answered, as a reply. A map with a `status` is taken at its
 * word; anything else is the body, so `=> { ok: true }` does the obvious thing.
 */
function asReply(value: unknown): ServerReply {
  if (value === undefined || value === null) return { status: 204 };
  if (isReplyShape(value)) return value as ServerReply;
  return { status: 200, body: value };
}

function isReplyShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const shape = value as Record<string, unknown>;
  return "status" in shape || "headers" in shape || "body" in shape;
}

function notFound(): ServerReply {
  return { status: 404, body: { error: "This server has no handler yet." } };
}

function fill(request: Partial<ServerRequest>): ServerRequest {
  return {
    method: request.method ?? "GET",
    url: request.url ?? "/",
    headers: request.headers ?? {},
    body: request.body ?? "",
  };
}

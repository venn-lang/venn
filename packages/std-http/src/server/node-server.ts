import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { asListenError } from "./http-server.errors.js";
import type {
  HttpServer,
  RequestHandler,
  RunningServer,
  ServerReply,
  ServerRequest,
} from "./http-server.types.js";

/** A node HttpServer, plus the way to hang up everything it still has open. */
export interface NodeHttpServer extends HttpServer {
  /**
   * Close every server started here that is still listening.
   *
   * A process owns its sockets, so whoever owns the process (the CLI) needs one
   * call to give them all back on the way out.
   */
  closeAll(): Promise<void>;
}

/**
 * The real implementation: a bound socket, on the port the OS gave it.
 *
 * Only this file reaches for `node:http`, which is why it sits behind the
 * `@venn/http/node` subpath. The rest of the package stays platform-neutral and
 * runs wherever the language runs, the editor's worker included.
 *
 * @throws VN7020 if the port is taken, VN7021 if the socket refuses to bind.
 */
export function createNodeServer(): NodeHttpServer {
  const open = new Set<RunningServer>();
  return {
    listen: async (args) => {
      const server = await bind(args);
      open.add(server);
      return { port: server.port, close: () => forget(open, server) };
    },
    closeAll: async () => {
      for (const server of [...open]) await forget(open, server);
    },
  };
}

/** Closing is idempotent from the set's point of view: gone is gone. */
async function forget(open: Set<RunningServer>, server: RunningServer): Promise<void> {
  open.delete(server);
  await server.close();
}

function bind(args: {
  port: number;
  host?: string;
  handle: RequestHandler;
}): Promise<RunningServer> {
  const { port, host, handle } = args;
  return new Promise<RunningServer>((resolve, reject) => {
    const at = host ?? "127.0.0.1";
    const server = createServer((request, response) => {
      void answer(request, response, handle);
    });
    // A busy port is the flow's problem, not a `node:net` errno: translate here.
    server.once("error", (error) => reject(asListenError({ port, host: at, error })));
    server.listen(port, at, () => resolve(running(server)));
  });
}

function running(server: ReturnType<typeof createServer>): RunningServer {
  const address = server.address();
  return {
    port: typeof address === "object" && address ? address.port : 0,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

/** A handler that throws becomes a 500: one bad request must not kill the server. */
async function answer(
  request: IncomingMessage,
  response: ServerResponse,
  handle: RequestHandler,
): Promise<void> {
  try {
    send(response, (await handle(await read(request))) ?? { status: 204 });
  } catch (error) {
    send(response, { status: 500, body: { error: String((error as Error)?.message ?? error) } });
  }
}

function send(response: ServerResponse, reply: ServerReply): void {
  const json = typeof reply.body !== "string" && reply.body !== undefined;
  const headers = { ...(json ? { "content-type": "application/json" } : {}), ...reply.headers };
  response.writeHead(reply.status ?? 200, headers);
  response.end(body(reply.body, json));
}

function body(value: unknown, json: boolean): string {
  if (value === undefined) return "";
  return json ? JSON.stringify(value) : String(value);
}

async function read(request: IncomingMessage): Promise<ServerRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return {
    method: request.method ?? "GET",
    url: request.url ?? "/",
    headers: plain(request.headers),
    body: Buffer.concat(chunks).toString("utf8"),
  };
}

function plain(headers: IncomingMessage["headers"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

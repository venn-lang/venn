import { portInUse } from "./http-server.errors.js";
import type {
  HttpServer,
  RequestHandler,
  RunningServer,
  ServerReply,
  ServerRequest,
} from "./http-server.types.js";

/** Where the double starts handing out ports when a flow asks for any free one. */
const EPHEMERAL_START = 49152;

/** A server that is listening in memory, plus the way to knock on its door. */
export interface MemoryServer extends RunningServer {
  /** Deliver a request as though it had arrived over the network. */
  deliver(request: Partial<ServerRequest>): Promise<ServerReply>;
  readonly closed: boolean;
}

/** The double factory, which keeps every server it started so a test can find it. */
export interface MemoryHttpServer extends HttpServer {
  /** Every server started through this, newest last. */
  readonly started: readonly MemoryServer[];
}

/**
 * The double: no socket, no network, no waiting.
 *
 * A test starts the flow that serves, hands it a request and reads the reply,
 * running the same handler the real server would call. Ports are book-kept here
 * rather than by the operating system, so tests beside each other never collide.
 */
export function createMemoryServer(): MemoryHttpServer {
  const started: MemoryServer[] = [];
  const bound = new Set<number>();
  let next = EPHEMERAL_START;
  return {
    started,
    // Binding the same port twice must fail here exactly as it would against a
    // real socket, so the double tracks what it has handed out.
    listen: async ({ port, host, handle }) => {
      const chosen = port === 0 ? next++ : port;
      if (bound.has(chosen)) throw portInUse({ port: chosen, host: host ?? "127.0.0.1" });
      bound.add(chosen);
      const server = memoryServer({ port: chosen, handle, release: () => bound.delete(chosen) });
      started.push(server);
      return server;
    },
  };
}

function memoryServer(args: {
  port: number;
  handle: RequestHandler;
  release: () => void;
}): MemoryServer {
  const state = { closed: false };
  return {
    port: args.port,
    get closed() {
      return state.closed;
    },
    close: async () => {
      state.closed = true;
      args.release();
    },
    deliver: async (request) => (await args.handle(fill(request))) ?? { status: 204 },
  };
}

function fill(request: Partial<ServerRequest>): ServerRequest {
  return {
    method: request.method ?? "GET",
    url: request.url ?? "/",
    headers: request.headers ?? {},
    body: request.body ?? "",
  };
}

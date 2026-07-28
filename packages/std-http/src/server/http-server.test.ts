import { describe, expect, it } from "vitest";
import { httpServerConformance, type ServerSpec } from "./http-server.suite.js";
import { createMemoryServer, type MemoryHttpServer } from "./memory-server.js";
import { createNodeServer } from "./node-server.js";

/** The double: the request goes straight to the handler that was registered. */
const memory: ServerSpec = {
  name: "memory",
  factory: () => createMemoryServer(),
  send: async ({ server, request }) => {
    const started = (server as MemoryHttpServer).started;
    const last = started[started.length - 1];
    if (!last) throw new Error("no server was started");
    const reply = await last.deliver(request);
    const json = typeof reply.body !== "string" && reply.body !== undefined;
    return {
      status: reply.status ?? (reply.body === undefined ? 204 : 200),
      body: json ? JSON.stringify(reply.body) : String(reply.body ?? ""),
      headers: {
        ...(json ? { "content-type": "application/json" } : {}),
        ...(reply.headers ?? {}),
      },
    };
  },
};

/** The real one: over a socket, on a port the operating system picked. */
const node: ServerSpec = {
  name: "node-http",
  factory: () => createNodeServer(),
  send: async ({ port, request }) => {
    const response = await fetch(`http://127.0.0.1:${port}${request.url ?? "/"}`, {
      method: request.method ?? "GET",
      headers: request.headers,
      body: request.body === undefined || request.body === "" ? undefined : request.body,
    });
    return {
      status: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
    };
  },
};

httpServerConformance(memory);
httpServerConformance(node);

// Beyond the port contract: the node factory owns real sockets, so it is the one
// that has to give them back when the process is asked to stop.
describe("createNodeServer · closeAll", () => {
  it("hangs up every server still listening, freeing the ports", async () => {
    const server = createNodeServer();
    const first = await server.listen({ port: 0, handle: () => ({ body: "" }) });
    const second = await server.listen({ port: 0, handle: () => ({ body: "" }) });

    await server.closeAll();

    const again = await server.listen({ port: first.port, handle: () => ({ body: "" }) });
    expect(again.port).toBe(first.port);
    expect(second.port).not.toBe(first.port);
    await server.closeAll();
  });

  it("does not mind a server the flow already closed", async () => {
    const server = createNodeServer();
    const running = await server.listen({ port: 0, handle: () => ({ body: "" }) });
    await running.close();

    await expect(server.closeAll()).resolves.toBeUndefined();
  });
});

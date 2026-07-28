import { expectVennError } from "@venn-lang/contracts/testing";
import { describe, expect, it } from "vitest";
import type { HttpServer, ServerReply, ServerRequest } from "./http-server.types.js";

/** How a suite reaches a server it just started, whichever kind it is. */
export interface ServerSpec {
  name: string;
  factory(): HttpServer | Promise<HttpServer>;
  /**
   * Send a request to a running server and read what came back. The real one
   * uses the network; the double hands it straight to the handler.
   */
  send(args: {
    server: HttpServer;
    port: number;
    request: Partial<ServerRequest>;
  }): Promise<{ status: number; body: string; headers: Record<string, string> }>;
}

/**
 * The HttpServer conformance suite. Both implementations run it, the socket one
 * and the in-memory one, because a double that answers differently from the real
 * thing is a test that lies.
 */
export function httpServerConformance(spec: ServerSpec): void {
  describe(`HttpServer · ${spec.name}`, () => {
    const start = async (handle: (request: ServerRequest) => ServerReply | undefined) => {
      const server = await spec.factory();
      const running = await server.listen({ port: 0, handle });
      return { server, running };
    };

    it("gives the handler the method, the path and the body", async () => {
      let seen: ServerRequest | undefined;
      const { server, running } = await start((request) => {
        seen = request;
        return { status: 200, body: "ok" };
      });

      await spec.send({
        server,
        port: running.port,
        request: { method: "POST", url: "/things?a=1", body: "hello" },
      });
      await running.close();

      expect(seen?.method).toBe("POST");
      expect(seen?.url).toBe("/things?a=1");
      expect(seen?.body).toBe("hello");
    });

    it("sends back the status and the body it was given", async () => {
      const { server, running } = await start(() => ({ status: 201, body: "made" }));

      const reply = await spec.send({ server, port: running.port, request: { url: "/" } });
      await running.close();

      expect(reply.status).toBe(201);
      expect(reply.body).toBe("made");
    });

    // A map is data, so it goes out as JSON: writing `JSON.stringify` by hand in
    // every handler is the ceremony this language exists to remove.
    it("sends anything that is not a string as JSON", async () => {
      const { server, running } = await start(() => ({ body: { ok: true, count: 2 } }));

      const reply = await spec.send({ server, port: running.port, request: { url: "/" } });
      await running.close();

      expect(JSON.parse(reply.body)).toEqual({ ok: true, count: 2 });
      expect(reply.headers["content-type"]).toContain("application/json");
    });

    it("answers 200 when no status is given, and 204 when nothing is", async () => {
      const { server, running } = await start(() => ({ body: "plain" }));
      const withBody = await spec.send({ server, port: running.port, request: { url: "/" } });
      await running.close();

      const empty = await start(() => undefined);
      const nothing = await spec.send({
        server: empty.server,
        port: empty.running.port,
        request: { url: "/" },
      });
      await empty.running.close();

      expect(withBody.status).toBe(200);
      expect(nothing.status).toBe(204);
    });

    it("reports the port it actually bound to", async () => {
      const { running } = await start(() => ({ body: "" }));
      const port = running.port;
      await running.close();

      expect(port).toBeGreaterThan(0);
    });

    // The failure a flow actually meets: it names a port, and something is there.
    it("refuses a port that is already taken, as VN7020", async () => {
      const server = await spec.factory();
      const first = await server.listen({ port: 0, handle: () => ({ body: "" }) });

      await expectVennError({
        op: () => server.listen({ port: first.port, handle: () => ({ body: "" }) }),
        code: /VN7020/,
      });
      await first.close();
    });

    it("lets the port be taken again once the server closed", async () => {
      const server = await spec.factory();
      const first = await server.listen({ port: 0, handle: () => ({ body: "" }) });
      await first.close();

      const second = await server.listen({ port: first.port, handle: () => ({ body: "" }) });
      await second.close();

      expect(second.port).toBe(first.port);
    });
  });
}

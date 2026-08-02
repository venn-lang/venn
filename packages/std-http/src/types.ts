import { type TypeSpec, t } from "@venn-lang/types";

/**
 * The types the plugin publishes to flows: `http.Request`, `http.Reply`,
 * `http.Server` and `http.Response`.
 *
 * They are data, not TypeScript, because the compiler and the editor read them
 * without loading the plugin's implementation. Keep them in step by hand with
 * `server/http-server.types.ts` and `port/http-client.types.ts`.
 */
export const httpTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /** One request, as the handler receives it. */
  Request: t.record({
    method: t.string,
    url: t.string,
    headers: t.map(t.string),
    body: t.string,
  }),
  /** What a handler may answer with. Anything else is taken as the body. */
  Reply: t.record(
    { status: t.number, headers: t.map(t.string), body: t.dynamic },
    { optional: ["status", "headers", "body"], open: true },
  ),
  /**
   * A bound socket: the port it got, and how to give it back.
   *
   * Attaching a handler is `http.on`, so the handle does not offer that itself.
   * The type names only what a program may do with the value, which is why it is
   * opaque with two visible members rather than fully opaque.
   */
  Server: t.opaque("http.Server", { port: t.number, close: t.fn([], t.void) }),
  /**
   * One response, as the client verbs give it back.
   *
   * `body` is the raw text, always a string whatever came over the wire. `json`
   * is that text parsed, and is the one field nothing can know the shape of: it
   * is whatever the far end chose to send. Name a shape for it, as in
   * `const price: Price = res.json`, and everything after reads as that shape.
   *
   * `time` is the whole milliseconds the round trip took, measured by whichever
   * client answered, so `expect res.time < 2s` is a question about the service
   * and not about the double.
   */
  Response: t.record(
    {
      status: t.number,
      ok: t.bool,
      headers: t.map(t.string),
      body: t.string,
      json: t.dynamic,
      time: t.number,
    },
    { open: true },
  ),
};

/** One request, ready to send: the verb, the absolute URL and the payload. */
export interface HttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  /** Aborted when a `race` this request runs inside has already been won. */
  signal?: AbortSignal;
}

/** What an http verb hands back, and what `res` holds in a flow. */
export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  json: unknown;
  /**
   * Whole milliseconds the round trip took, from the request going out to the
   * body being in hand.
   *
   * Every implementation measures it, including the double, and none of them
   * takes it from a canned response: a number a test wrote by hand would make
   * `expect res.time < 2s` pass for a reason that has nothing to do with time.
   */
  time: number;
}

/**
 * The three ways a request fails that every implementation names alike:
 * nothing accepted the connection, the name did not resolve, and no answer
 * came back in time.
 *
 * They are told apart rather than folded into one message because the three
 * ask for three different things of whoever reads them: start the service,
 * fix the address, or wait longer.
 */
export type HttpFailure = "refused" | "not-found" | "timeout";

/**
 * Sending one request and reading the reply.
 *
 * Two implementations: `createFetchClient` over a real socket and
 * `createFakeClient` for tests. The conformance suite is what says they agree.
 *
 * A failure is a `VennError` carrying a `VN7xxx` code, never the host
 * runtime's own words. See {@link HttpFailure}.
 */
export interface HttpClient {
  request(req: HttpRequest): Promise<HttpResponse>;
}

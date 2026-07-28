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
  time: number;
}

/**
 * Sending one request and reading the reply.
 *
 * Two implementations: `createFetchClient` over a real socket and
 * `createFakeClient` for tests. The conformance suite is what says they agree.
 */
export interface HttpClient {
  request(req: HttpRequest): Promise<HttpResponse>;
}

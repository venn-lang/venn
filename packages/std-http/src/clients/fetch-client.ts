import type { HttpClient, HttpResponse } from "../port/index.js";

/**
 * The real client, over the global `fetch`. Requires the `net` capability.
 *
 * The body is always read as text and parsed afterwards, so a reply that claims
 * JSON but is not still arrives whole in `body` instead of throwing.
 */
export function createFetchClient(): HttpClient {
  return {
    async request(req): Promise<HttpResponse> {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: req.signal,
      });
      const body = await response.text();
      return mapResponse({
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        body,
      });
    },
  };
}

function mapResponse(args: {
  status: number;
  ok: boolean;
  headers: Headers;
  body: string;
}): HttpResponse {
  return {
    status: args.status,
    ok: args.ok,
    headers: toObject(args.headers),
    body: args.body,
    json: tryJson(args.body),
    time: 0,
  };
}

function toObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function tryJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

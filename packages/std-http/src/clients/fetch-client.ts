import type { HttpClient, HttpRequest, HttpResponse } from "../port/index.js";
import { asRequestError } from "./fetch-failure.js";
import { startStopwatch } from "./stopwatch.js";

/**
 * The real client, over the global `fetch`. Requires the `net` capability.
 *
 * The body is always read as text and parsed afterwards, so a reply that claims
 * JSON but is not still arrives whole in `body` instead of throwing.
 *
 * @returns An {@link HttpClient} that sends over the network.
 */
export function createFetchClient(): HttpClient {
  return { request: (req) => send(req) };
}

async function send(req: HttpRequest): Promise<HttpResponse> {
  const elapsed = startStopwatch();
  try {
    return await roundTrip(req, elapsed);
  } catch (error) {
    throw asRequestError({
      attempt: { method: req.method, url: req.url, elapsedMs: elapsed() },
      error,
    });
  }
}

/** The clock stops once the body is in hand, which is when the request is done. */
async function roundTrip(req: HttpRequest, elapsed: () => number): Promise<HttpResponse> {
  const response = await fetch(req.url, initOf(req));
  const body = await response.text();
  const { status, ok, headers } = response;
  return mapResponse({ status, ok, headers, body, time: elapsed() });
}

function initOf(req: HttpRequest): RequestInit {
  return { method: req.method, headers: req.headers, body: req.body, signal: req.signal };
}

function mapResponse(args: {
  status: number;
  ok: boolean;
  headers: Headers;
  body: string;
  time: number;
}): HttpResponse {
  return {
    status: args.status,
    ok: args.ok,
    headers: toObject(args.headers),
    body: args.body,
    json: tryJson(args.body),
    time: args.time,
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

import type { HttpClient, HttpFailure, HttpRequest, HttpResponse } from "../port/index.js";
import { type Attempt, requestFailed } from "./http-client.errors.js";
import { startStopwatch } from "./stopwatch.js";

/**
 * A 200 response with a small JSON body, for tests that only care about a field
 * or two.
 *
 * `time` is not one of the fields worth setting: the double stamps what the
 * call really took over whatever a canned response carries.
 *
 * @param overrides Fields to replace on the default response.
 * @returns A complete {@link HttpResponse}.
 */
export function okResponse(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    status: 200,
    ok: true,
    headers: {},
    body: '{"ok":true}',
    json: { ok: true },
    time: 0,
    ...overrides,
  };
}

/**
 * The double: answers from a table keyed by the request's full URL.
 *
 * A URL with no entry gets {@link okResponse}, so a test only has to name the
 * responses it cares about. Never touches the network.
 *
 * It fails the way the network fails, and takes the time it says it takes: a
 * double that always answered instantly and always answered something would be
 * no use to a test about a service that is slow or down.
 *
 * @param args.responses Canned responses, keyed by the URL the flow requests.
 * @param args.failures URLs that fail instead of answering, and how.
 * @param args.latency Milliseconds to really wait before answering, which is
 * then what `res.time` reports.
 * @returns An {@link HttpClient} that stays offline.
 */
export function createFakeClient(
  args: {
    responses?: Record<string, HttpResponse>;
    failures?: Record<string, HttpFailure>;
    latency?: number;
  } = {},
): HttpClient {
  const responses = args.responses ?? {};
  const failures = args.failures ?? {};
  const latency = args.latency ?? 0;
  return {
    request: async (req) => {
      const elapsed = startStopwatch();
      if (latency > 0) await pause(latency);
      const failure = failures[req.url];
      if (failure) throw requestFailed({ attempt: attemptOf(req, elapsed()), failure });
      return { ...(responses[req.url] ?? okResponse()), time: elapsed() };
    },
  };
}

function attemptOf(req: HttpRequest, elapsedMs: number): Attempt {
  return { method: req.method, url: req.url, elapsedMs };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

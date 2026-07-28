import type { HttpClient, HttpResponse } from "../port/index.js";

/**
 * A 200 response with a small JSON body, for tests that only care about a field
 * or two.
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
 * @param args.responses Canned responses, keyed by the URL the flow requests.
 */
export function createFakeClient(
  args: { responses?: Record<string, HttpResponse> } = {},
): HttpClient {
  const responses = args.responses ?? {};
  return {
    request: async (req) => responses[req.url] ?? okResponse(),
  };
}

import type { GqlClient, GqlRequest, GqlResponse } from "../port/index.js";

/**
 * A successful envelope: an empty `data` object and no `errors`.
 *
 * @param overrides Fields to replace on the default envelope.
 * @returns A complete {@link GqlResponse}.
 */
export function okGraphqlResponse(overrides: Partial<GqlResponse> = {}): GqlResponse {
  return { data: {}, errors: undefined, ...overrides };
}

/**
 * The double: canned envelopes, and no endpoint.
 *
 * A document with no entry in `responses` falls back to `response`, so a test
 * only names the documents it cares about. `execute` and `subscribe` resolve
 * from the same table.
 *
 * @param args.responses Envelopes keyed by the exact document text.
 * @param args.response What every other document gets. Defaults to
 *   {@link okGraphqlResponse}.
 */
export function createFakeClient(
  args: { response?: GqlResponse; responses?: Record<string, GqlResponse> } = {},
): GqlClient {
  const responses = args.responses ?? {};
  const fallback = args.response ?? okGraphqlResponse();
  const resolve = (req: GqlRequest): GqlResponse => responses[req.query] ?? fallback;
  return {
    execute: async (req) => resolve(req),
    subscribe: async (req) => resolve(req),
  };
}

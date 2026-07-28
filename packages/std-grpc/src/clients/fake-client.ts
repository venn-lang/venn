import type { GrpcClient, GrpcMethodInfo } from "../port/index.js";

/**
 * The double: canned answers, and no channel.
 *
 * Anything not named falls back to an empty value (`{}` for a call, `[]` for a
 * stream or a reflection), so a test only lists what it cares about.
 *
 * @param config.responses Unary results, keyed by `package.Service/Method`.
 * @param config.streams Streamed results, keyed by the same.
 * @param config.reflection Method metadata, keyed by service name.
 */
export function createFakeClient(
  config: {
    responses?: Record<string, unknown>;
    streams?: Record<string, readonly unknown[]>;
    reflection?: Record<string, readonly GrpcMethodInfo[]>;
  } = {},
): GrpcClient {
  const { responses = {}, streams = {}, reflection = {} } = config;
  return {
    call: async (call) => responses[call.method] ?? {},
    stream: async (call) => streams[call.method] ?? [],
    reflect: async (service) => reflection[service] ?? [],
  };
}

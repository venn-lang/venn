import { type TypeSpec, t } from "@venn/types";

/**
 * The types the plugin publishes to flows, as `grpc.MethodInfo`.
 *
 * Mirrors `GrpcMethodInfo` in `port/grpc-client.types.ts` by hand. Reflection is
 * the only thing this plugin can describe: a call's request and response come
 * from a `.proto` nobody here has read, so they stay dynamic.
 */
export const grpcTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /** One RPC method, as server reflection describes it. */
  MethodInfo: t.record({
    name: t.string,
    requestType: t.string,
    responseType: t.string,
    clientStreaming: t.bool,
    serverStreaming: t.bool,
  }),
};

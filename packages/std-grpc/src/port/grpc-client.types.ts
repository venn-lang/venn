/** One invocation: the full `package.Service/Method`, plus the request message. */
export interface GrpcCall {
  method: string;
  request?: Record<string, unknown>;
}

/** Metadata for one RPC method, as returned by server reflection. */
export interface GrpcMethodInfo {
  name: string;
  requestType: string;
  responseType: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
}

/**
 * Calling a gRPC service.
 *
 * `stream` hands back the whole sequence once it is complete rather than a live
 * stream, so a flow reads it as an ordinary list.
 *
 * Two implementations: `createRealClient` and `createFakeClient`.
 */
export interface GrpcClient {
  call(call: GrpcCall): Promise<unknown>;
  stream(call: GrpcCall): Promise<readonly unknown[]>;
  reflect(service: string): Promise<readonly GrpcMethodInfo[]>;
}

import { type ActionDefinition, type ActionInput, arg, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { type GrpcCall, GrpcClientPort } from "../port/index.js";

const requestParams = z.record(z.string(), z.unknown()).optional();

/**
 * `grpc.call "pkg.Service/Method" { id: 42 }`: one unary call.
 *
 * The method is the only positional argument and the options map is the request
 * message. The result is dynamic because its shape lives in a `.proto` this
 * plugin never reads.
 */
export const callAction: ActionDefinition = defineAction({
  name: "call",
  doc: "Unary gRPC call.",
  params: requestParams,
  args: [arg("method", t.string, "The full method: `package.Service/Method`.")],
  result: t.dynamic,
  run: (ctx, input) => ctx.port(GrpcClientPort).call(buildCall(input)),
});

/**
 * `grpc.stream "pkg.Service/Method" { id: 42 }`: a server-streaming call.
 *
 * The messages come back as a list, collected once the stream ends. A flow reads
 * it like any other list; there is nothing live to subscribe to.
 */
export const streamAction: ActionDefinition = defineAction({
  name: "stream",
  doc: "Server-streaming gRPC call.",
  params: requestParams,
  args: [arg("method", t.string, "The full method: `package.Service/Method`.")],
  result: t.list(t.dynamic),
  run: (ctx, input) => ctx.port(GrpcClientPort).stream(buildCall(input)),
});

/**
 * `grpc.reflect "pkg.Service"`: ask the server what methods it has.
 *
 * The one verb here with a typed result, because `grpc.MethodInfo` is described
 * by the reflection protocol rather than by anyone's `.proto`.
 */
export const reflectAction: ActionDefinition = defineAction({
  name: "reflect",
  doc: "Server reflection: list a service's methods.",
  args: [arg("service", t.string, "The service to ask about.")],
  result: t.list(t.ref("grpc.MethodInfo")),
  run: (ctx, input) => ctx.port(GrpcClientPort).reflect(String(input.args[0] ?? "")),
});

function buildCall(input: ActionInput<unknown>): GrpcCall {
  return {
    method: String(input.args[0] ?? ""),
    request: (input.params ?? undefined) as Record<string, unknown> | undefined,
  };
}

import { VennError } from "@venn-lang/contracts";

/** VN7020: the address the flow asked for is already taken by something else. */
export function portInUse(args: { port: number; host: string }): VennError {
  return new VennError({
    code: "VN7020",
    message: `Port ${args.port} is already in use — stop whatever is listening on ${args.host}:${args.port}, or ask for "port: 0" to take any free one.`,
    detail: { port: args.port, host: args.host, cause: "EADDRINUSE" },
  });
}

/** VN7021: the socket refused to bind for any other reason. */
export function listenFailed(args: { port: number; host: string; cause: string }): VennError {
  return new VennError({
    code: "VN7021",
    message: `Could not listen on ${args.host}:${args.port} — ${args.cause}.`,
    detail: { port: args.port, host: args.host, cause: args.cause },
  });
}

/**
 * Whatever the socket threw, as a Venn error: VN7020 for `EADDRINUSE`, VN7021
 * for anything else.
 *
 * The translation lives at the producer so no caller has to read a `node:net`
 * errno to know what went wrong.
 */
export function asListenError(args: { port: number; host: string; error: unknown }): VennError {
  const error = args.error as { code?: string; message?: string } | undefined;
  if (error?.code === "EADDRINUSE") return portInUse({ port: args.port, host: args.host });
  return listenFailed({
    port: args.port,
    host: args.host,
    cause: error?.message ?? String(args.error),
  });
}

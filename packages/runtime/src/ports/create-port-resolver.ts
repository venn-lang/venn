import { bindPort, type HostCapability, type Port, VennError } from "@venn/contracts";
import type { PortBinding, PortResolver } from "./port-resolver.types.js";

/**
 * Resolve ports from a set of bindings, running capability and shape negotiation
 * at the moment of resolution.
 *
 * @param args.bindings Every port the host chose to bind, with its implementation.
 * @param args.caps What this host offers, checked against each port's `requires`.
 * @returns A resolver whose `resolve` throws `VN7002` when the port is unbound,
 * and whatever `bindPort` raises when the capability or shape check fails.
 */
export function createPortResolver(args: {
  bindings: readonly PortBinding[];
  caps: readonly HostCapability[];
}): PortResolver {
  const byId = new Map(args.bindings.map((binding) => [binding.port.id, binding] as const));
  return {
    resolve: <T>(port: Port<T>): T =>
      resolveOne({ port, binding: byId.get(port.id), caps: args.caps }),
  };
}

function resolveOne<T>(args: {
  port: Port<T>;
  binding: PortBinding | undefined;
  caps: readonly HostCapability[];
}): T {
  if (!args.binding) throw unbound(args.port.id);
  return bindPort({ port: args.port, impl: args.binding.impl, caps: args.caps });
}

function unbound(id: string): VennError {
  return new VennError({
    code: "VN7002",
    message: `No implementation bound for port "${id}".`,
    detail: { port: id },
  });
}

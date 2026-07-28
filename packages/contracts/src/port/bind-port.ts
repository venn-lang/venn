import type { HostCapability } from "../capabilities/index.js";
import { assertCapabilities } from "./assert-capabilities.js";
import { assertPortShape } from "./assert-port-shape.js";
import type { Port } from "./port.types.js";

/**
 * The single loader entry. Negotiates capabilities, checks the implementation's
 * shape, then hands it back typed as `T`.
 *
 * Both checks run before anything is bound, so a mismatch is reported at start
 * up rather than as a `TypeError` in the middle of a test.
 *
 * @param args.port - the descriptor to bind against.
 * @param args.impl - the candidate implementation, untrusted.
 * @param args.caps - the capabilities the host advertises.
 * @returns `args.impl` typed as `T`.
 * @throws VennError VN2010 when the host lacks a required capability, VN2011
 * when the implementation is missing a declared method.
 */
export function bindPort<T>(args: {
  port: Port<T>;
  impl: unknown;
  caps: readonly HostCapability[];
}): T {
  assertCapabilities({ port: args.port, caps: args.caps });
  assertPortShape({ port: args.port, impl: args.impl });
  return args.impl as T;
}

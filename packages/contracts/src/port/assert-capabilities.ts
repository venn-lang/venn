import type { HostCapability } from "../capabilities/index.js";
import { hostMissingCapability } from "../errors/index.js";
import { missingCapabilities } from "./missing-capabilities.js";
import type { Port } from "./port.types.js";

/**
 * Checks the host against what the port requires.
 *
 * @throws VennError VN2010 when a required capability is absent.
 */
export function assertCapabilities<T>(args: {
  port: Port<T>;
  caps: readonly HostCapability[];
}): void {
  const missing = missingCapabilities({ requires: args.port.requires, caps: args.caps });
  if (missing.length === 0) return;
  throw hostMissingCapability({ portId: args.port.id, missing, present: args.caps });
}

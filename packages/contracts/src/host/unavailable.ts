import type { HostCapability } from "../capabilities/index.js";
import { capabilityUnavailable } from "../errors/index.js";

/**
 * A stand-in for a port the host cannot provide, such as `process` in a Worker.
 *
 * @param args.capability - the capability the host lacks, named in the error.
 * @param args.methods - the port's declared methods, usually `SomePort.methods`.
 * @returns an object shaped like `T` whose every method throws VN2012 when
 * called, rather than failing as a `TypeError` mid-run.
 */
export function unavailable<T>(args: {
  capability: HostCapability;
  methods: readonly string[];
}): T {
  const bag: Record<string, unknown> = {};
  for (const method of args.methods) {
    bag[method] = () => {
      throw capabilityUnavailable({ capability: args.capability, method });
    };
  }
  return bag as T;
}

import type { HostCapability } from "../capabilities/index.js";

/**
 * The gap between what is required and what the host offers.
 *
 * @returns the required capabilities absent from `caps`, in the order required.
 */
export function missingCapabilities(args: {
  requires: readonly HostCapability[];
  caps: readonly HostCapability[];
}): readonly HostCapability[] {
  const present = new Set(args.caps);
  return args.requires.filter((cap) => !present.has(cap));
}

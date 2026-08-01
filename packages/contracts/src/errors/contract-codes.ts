import type { HostCapability } from "../capabilities/index.js";
import { HOST_CODES } from "./host-codes.js";
import { VennError } from "./venn-error.js";

/** VN2010: a port requires capabilities the host does not provide. */
export function hostMissingCapability(args: {
  portId: string;
  missing: readonly HostCapability[];
  present: readonly HostCapability[];
}): VennError {
  const message =
    `Port "${args.portId}" requires capability ${quote(args.missing)}, ` +
    `which this host does not provide. Present: ${list(args.present)}.`;
  return new VennError({
    code: HOST_CODES.VN2010_MISSING_CAPABILITY,
    message,
    detail: { ...args },
  });
}

/** VN2011: an implementation is missing one or more methods the port declares. */
export function portShapeMismatch(args: { portId: string; missing: readonly string[] }): VennError {
  const message = `Implementation of "${args.portId}" is missing method(s): ${args.missing.join(", ")}.`;
  return new VennError({ code: HOST_CODES.VN2011_PORT_SHAPE, message, detail: { ...args } });
}

/** VN2012: code reached a capability the host declared unavailable. */
export function capabilityUnavailable(args: {
  capability: HostCapability;
  method: string;
}): VennError {
  const message = `Capability "${args.capability}" is not available on this host (called "${args.method}").`;
  return new VennError({
    code: HOST_CODES.VN2012_CAPABILITY_UNAVAILABLE,
    message,
    detail: { ...args },
  });
}

function quote(caps: readonly string[]): string {
  return caps.map((c) => `"${c}"`).join(", ");
}

function list(caps: readonly string[]): string {
  return caps.length === 0 ? "(none)" : caps.join(", ");
}

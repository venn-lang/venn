import { portShapeMismatch } from "../errors/index.js";
import type { Port } from "./port.types.js";

/**
 * Checks the implementation against the methods the port declares.
 *
 * @throws VennError VN2011 when a declared method is missing or is not callable.
 */
export function assertPortShape<T>(args: { port: Port<T>; impl: unknown }): void {
  const missing = missingMethods(args.port, args.impl);
  if (missing.length === 0) return;
  throw portShapeMismatch({ portId: args.port.id, missing });
}

function missingMethods<T>(port: Port<T>, impl: unknown): readonly string[] {
  const bag = impl as Record<string, unknown> | null | undefined;
  return port.methods.filter((m) => typeof bag?.[m] !== "function");
}

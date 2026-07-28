import type { AnyPort, Port } from "@venn/contracts";

/** A port paired with the implementation a host/CLI chose to bind. */
export interface PortBinding {
  port: AnyPort;
  impl: unknown;
}

/** Resolves a port descriptor to its bound, negotiated implementation. */
export interface PortResolver {
  resolve<T>(port: Port<T>): T;
}

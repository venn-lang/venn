import type { FnType, Type } from "./type.types.js";

/**
 * What the checker knows that the file itself does not: the types the loaded
 * plugins contribute.
 *
 * The core has no idea what a plugin is, and must not: it asks this interface
 * two questions and takes the answers. Whoever owns the registry, the runtime or
 * the language server, is the one that can answer them.
 */
export interface TypeCatalog {
  /** A named type: `http.Request`. Undefined when nothing declares it. */
  typeOf(name: string): Type | undefined;
  /** A verb's signature: `http.serve`, `http.on`. */
  signatureOf(target: string): FnType | undefined;
  /** A constant a namespace publishes: `math.pi`. Not everything has one. */
  valueOf?(target: string): Type | undefined;
}

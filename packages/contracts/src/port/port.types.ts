import type { HostCapability } from "../capabilities/index.js";

/**
 * A typed contract carrying at least two implementations, one real and one
 * double.
 *
 * Deliberately not a Zod schema: in Zod 4 `z.function` is a factory rather than
 * a validatable type, so a port's function shape cannot be expressed as data.
 * `methods` buys a compile-time check (each entry must be a key of `T`) and a
 * load-time one (`typeof` per method); the behavioural guarantee is the
 * conformance suite.
 *
 * @typeParam T - the interface the implementation must satisfy.
 */
export interface Port<T> {
  /** Stable identity, e.g. "venn.port.filesystem". */
  readonly id: string;
  /** Version of the contract, not of the package. Removing a method bumps it. */
  readonly version: number;
  /** Capabilities negotiated against `Host.caps` before binding. */
  readonly requires: readonly HostCapability[];
  /** Methods an implementation must provide. Each must be a key of `T`. */
  readonly methods: readonly (keyof T & string)[];
}

/**
 * A `Port<T>` with its element type erased. Every `Port<T>` is assignable to it
 * (its `methods` widen to `string[]`), so a heterogeneous collection of ports,
 * such as the runtime's binding table, types without variance friction.
 */
export type AnyPort = {
  readonly id: string;
  readonly version: number;
  readonly requires: readonly HostCapability[];
  readonly methods: readonly string[];
};

import type { Instant, UnitValue } from "../units/index.js";

/** A runtime value in the language: primitives, unit values, lists, and maps. */
export type Value =
  | null
  | boolean
  | number
  | string
  | UnitValue
  | Instant
  | readonly Value[]
  | { readonly [key: string]: Value };

import type { ValueDefinition } from "./types/value.types.js";

/**
 * Publish a constant under a namespace: `math.pi`, `date.epoch`.
 *
 * @param definition The name, what it is for, its type and the value itself.
 * @returns The definition, unchanged, typed for whoever reads it.
 */
export function defineValue(definition: ValueDefinition): ValueDefinition {
  return definition;
}

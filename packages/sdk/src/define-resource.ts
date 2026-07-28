import type { ResourceDefinition } from "./types/resource.types.js";

/**
 * Define a resource: a handle the runner opens and closes for you at the scope
 * you name (suite, worker, flow or step).
 *
 * @param def Name, scope, and the `open` / `close` hooks.
 * @returns The same definition, typed.
 */
export function defineResource<T>(def: ResourceDefinition<T>): ResourceDefinition<T> {
  return def;
}

import type { DecoratorDefinition } from "./types/decorator.types.js";

/**
 * Define a decorator: a plugin's own `@name`, expanded once over the program
 * before anything else reads it.
 *
 * `expand` receives the node the decorator was written on and may leave a fact
 * behind with `meta`, put another node in its place with `replace`, take it out
 * with `remove`, or refuse the program with `reject`.
 *
 * @param def Name, docs, the `$type`s it targets, and the `expand` hook.
 * @returns The same definition, typed.
 */
export function defineDecorator(def: DecoratorDefinition): DecoratorDefinition {
  return def;
}

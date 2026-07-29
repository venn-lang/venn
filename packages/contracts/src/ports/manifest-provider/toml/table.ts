/**
 * An empty table for a manifest to fill.
 *
 * Made without a prototype, so a key read from the file is a key and nothing
 * else. Assigning `__proto__` onto an ordinary object changes how every object
 * in the process behaves, and a manifest arrives with somebody else's project:
 * a `venn.toml` holding `[package.__proto__]` was enough to put a property on
 * `Object.prototype`.
 *
 * Refusing that one name would have closed that one door. Having no prototype
 * to reach removes the question, and the table is read with `Object.keys` and
 * `Object.entries`, which do not care that it has none.
 */
export function emptyTable(): Record<string, unknown> {
  return Object.create(null) as Record<string, unknown>;
}

/**
 * A name a table declares, as against a name every object inherits.
 *
 * The member tables are ordinary object literals, so a plain lookup also
 * reaches `Object.prototype`: `m["constructor"]` handed back a host `Function`,
 * the checker carried it on as a `Type`, and the reader was told
 * `expected number, found undefined` because `showType` was printing an object
 * with no `kind` on it. `expr/methods/index.ts` fences the runtime's tables the
 * same way, and the two halves have to agree about what a member is.
 */

/**
 * What a table holds under a name, and nothing it inherits.
 *
 * @param table Any of the member tables, which are plain object literals.
 * @param name The member being looked up, which may be anything a program wrote.
 * @returns The entry, or undefined when the table does not declare that name.
 */
export function declared<T>(table: Record<string, T>, name: string): T | undefined {
  return Object.hasOwn(table, name) ? table[name] : undefined;
}

/**
 * Keys that reach the prototype rather than the object.
 *
 * A manifest is data that arrives with somebody else's project, and assigning
 * one of these from it changes how every object in the process behaves. A
 * `venn.toml` containing `[package.__proto__]` was enough to put a property on
 * `Object.prototype`.
 */
const RESERVED: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Whether a key read from a manifest may be assigned.
 *
 * @param key The key exactly as it was written in the file.
 * @returns `false` for a key that would reach the prototype, which the caller
 * should skip rather than assign.
 */
export function isSafeKey(key: string): boolean {
  return !RESERVED.has(key);
}

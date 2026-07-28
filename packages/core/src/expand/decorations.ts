import { readMeta, writeMeta } from "./node-meta.js";

/**
 * Where `.wrap`, `.before` and `.after` leave their closures.
 *
 * Prefixed, because `meta` is open to any key a decorator invents and a program
 * that writes `target.meta "before" x` must not be mistaken for one that wrote
 * `target.before(f)`.
 */
export const AROUND_KEYS = {
  wrap: "deco.wrap",
  before: "deco.before",
  after: "deco.after",
} as const;

/** The closures a `deco` asked to run around this declaration. */
export interface Decorations {
  readonly wrap: readonly unknown[];
  readonly before: readonly unknown[];
  readonly after: readonly unknown[];
}

/**
 * What the behavioural verbs left on this node, or nothing at all.
 *
 * The language has no syntax for "around this body", so `.wrap` cannot rewrite
 * the tree the way `.addParam` does. It records a fact about the declaration
 * and the scheduler honours it.
 */
export function readDecorations(node: object): Decorations | undefined {
  const wrap = readMeta<unknown[]>(node, AROUND_KEYS.wrap);
  const before = readMeta<unknown[]>(node, AROUND_KEYS.before);
  const after = readMeta<unknown[]>(node, AROUND_KEYS.after);
  if (!wrap && !before && !after) return undefined;
  return { wrap: wrap ?? [], before: before ?? [], after: after ?? [] };
}

/** Append one closure to a behavioural list, keeping the order they were written. */
export function addDecoration(node: object, key: string, fn: unknown): void {
  writeMeta(node, key, [...(readMeta<unknown[]>(node, key) ?? []), fn]);
}

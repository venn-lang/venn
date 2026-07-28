/** Where a `#alias/…` specifier points. */
export interface AliasTarget {
  /** The directory `[paths]` maps the alias to. */
  dir: string;
  /** What followed the alias, with the separating slash removed. */
  rest: string;
}

/**
 * Split a `#alias/rest` import specifier against `[paths]` from `venn.toml`.
 *
 * @returns undefined when the specifier names no configured alias, which the
 * caller reads as a relative or bare path.
 */
export function resolveAlias(args: {
  spec: string;
  paths: Record<string, string>;
}): AliasTarget | undefined {
  const alias = Object.keys(args.paths).find((key) => args.spec.startsWith(`${key}/`));
  if (!alias) return undefined;
  return { dir: args.paths[alias] as string, rest: args.spec.slice(alias.length + 1) };
}

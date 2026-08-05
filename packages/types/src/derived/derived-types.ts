/**
 * Where an install leaves the types it derived from a package's TypeScript
 * declarations, and what it calls each file.
 *
 * Two readers, and neither may import the other: the CLI writes these files at
 * install and reads them back on `venn run`, and the language server reads them
 * on every keystroke. They spelled the layout out separately, in `node:path`
 * and in Langium's `UriUtils`, and both mangled a scoped name with `replace`
 * where they meant `replaceAll`, so `@a/b/c` landed in one file and was looked
 * for in another. The segments are given rather than a joined path because the
 * two join differently, and this package knows nothing about either.
 */

/** The folder, relative to a project root. Derived, so under `target/`. */
export const DERIVED_TYPES_DIR: readonly string[] = ["target", "types"];

/**
 * The file a package's derived types are written to, without a directory.
 *
 * @param name The package specifier, scope and all.
 * @returns The file name. A scope holds a slash and a file name cannot, so
 * every slash becomes `__`: `@types/node` is `@types__node.json`.
 */
export function derivedTypesFile(name: string): string {
  return `${name.replaceAll("/", "__")}.json`;
}

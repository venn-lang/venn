import { isPackageSpecifier } from "./specifier.js";

/** The name a folder's face carries, so a caller names the folder and no more. */
export const MODULE_FILE = "mod.vn";

const EXTENSION = ".vn";

/**
 * Where a specifier leads, as a path relative to whatever it was written
 * against.
 *
 * **An extension means a file. No extension means a folder.**
 *
 * ```
 * "./cart.vn"   ->  ./cart.vn
 * "./cart"      ->  ./cart/mod.vn
 * "#lib/cart"   ->  #lib/cart/mod.vn
 * ```
 *
 * No cascade: never "try `.vn`, then `/mod.vn`, then `/index.vn`". Whoever
 * reads the import knows from the string alone whether it points at a file or a
 * folder, and there is no resolution order to learn or to get wrong. A folder
 * with no face is not a module, and the import that named one says so with the
 * path it looked for.
 *
 * @param spec The specifier as written.
 * @returns The same specifier for a package, which is nobody's file, and
 * otherwise the path to read.
 */
export function moduleFileOf(spec: string): string {
  if (isPackageSpecifier(spec) || spec.endsWith(EXTENSION)) return spec;
  return `${withoutTrailing(spec)}/${MODULE_FILE}`;
}

/**
 * A folder written with a separator after it names the same folder.
 *
 * Walked rather than matched with an anchored `+`, which backtracks: that
 * pattern is quadratic on a specifier made only of separators, and this is
 * linear on any of them.
 */
function withoutTrailing(spec: string): string {
  let end = spec.length;
  while (end > 0 && (spec[end - 1] === "/" || spec[end - 1] === "\\")) end -= 1;
  return spec.slice(0, end);
}

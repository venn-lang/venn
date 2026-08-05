import { type Document, isValueImport, type ValueImport } from "@venn-lang/core";

/** The import a module hands a name on through, and its name over there. */
export interface HandedOn {
  /** The `pub import` to follow. */
  decl: ValueImport;
  /** What the file behind it calls the name. */
  name: string;
}

/**
 * The `pub import` of a module that hands on `wanted`, and its name over there.
 *
 * A folder with a face declares nothing: `larder/mod.vn` is three `pub import`
 * lines, so asking whether it declares `order` answers no while
 * `import { order } from "./larder"` is correct and runs. Every reader that
 * stopped at the first file got that wrong, in its own way: the checker said
 * `VN2005 · Unknown fragment "order"` and the hover fell back to `fragment …`
 * over the intermediate file rather than the signature where it lives.
 *
 * The two names can differ. `pub import { order as pedido }` hands on `pedido`
 * and is called `order` in the file behind it, so a walk that carried the outer
 * name onwards would stop one file too early.
 *
 * @param module The module being asked.
 * @param wanted The name a caller is looking for in it.
 * @returns The import to follow and the name to ask it for, or nothing.
 */
export function handsOn(module: Document, wanted: string): HandedOn | undefined {
  for (const decl of module.imports) {
    if (!isValueImport(decl) || !decl.export) continue;
    const name = under(decl, wanted);
    if (name !== undefined) return { decl, name };
  }
  return undefined;
}

/**
 * What this import calls `wanted` in the file it reads from.
 *
 * Only the named form hands a fragment on. A wildcard binds one name for the
 * whole module and a default binds its own, and neither is a fragment `run` can
 * take, so following either would be looking for something that cannot be there.
 */
function under(decl: ValueImport, wanted: string): string | undefined {
  if (decl.wildcard || decl.default) return undefined;
  return decl.names.find((one) => (one.alias ?? one.name) === wanted)?.name;
}

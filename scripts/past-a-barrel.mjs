/**
 * Imports that reach into a module past the barrel it publishes.
 *
 * Three things look alike in a grep and only one of them is the rule being
 * broken, so each is decided here rather than counted together:
 *
 * - reaching into a folder that has an `index.ts`, at any file but that one.
 *   This is the violation: the module says how it is entered and the import
 *   walks round it.
 * - reaching into a folder that has no barrel at all. There is nothing to go
 *   through, so it is the missing-barrel rule wearing a different hat, and it
 *   is held elsewhere.
 * - reaching up to a file in a folder above. `../lex-scope.js` is a file in the
 *   module the importer is part of, not another module's internals, so it does
 *   not count.
 */
import { candidates, relative, slashed, specifiers } from "./repo-sources.mjs";

const GENERATED = "core/src/generated/";

const folderOf = (path) => path.split("/").slice(0, -1).join("/");

const isAncestor = (folder, of) => `${of}/`.startsWith(`${folder}/`);

/** Whether one import walks round a barrel that exists. */
function bypasses(args) {
  const target = candidates(args.from, args.specifier).find((one) => args.source.has(one));
  if (!target || target.endsWith("/index.ts")) return false;
  const folder = folderOf(target);
  if (folder === folderOf(args.from) || isAncestor(folder, folderOf(args.from))) return false;
  return args.source.has(`${folder}/index.ts`);
}

/** How many times each file reaches past a barrel, with the clean files left out. */
export async function pastABarrel(source) {
  const found = {};
  for (const [path, text] of source) {
    if (relative(path).includes(GENERATED)) continue;
    const count = specifiers(text)
      .filter((one) => one.startsWith("."))
      .filter((specifier) => bypasses({ from: slashed(path), specifier, source })).length;
    if (count > 0) found[relative(path)] = count;
  }
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => (a < b ? -1 : 1)));
}

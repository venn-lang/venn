import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveAlias } from "@venn-lang/contracts";
import { moduleFileOf } from "@venn-lang/core";
import type { ModuleIo } from "@venn-lang/runtime";

/** Where a `#alias/…` specifier is resolved from. */
interface Roots {
  paths: Record<string, string>;
  rootDir: string;
}

/**
 * Node-backed module IO: read files, resolve relative specifiers against the
 * importer, and `#alias/…` specifiers through `[paths]` in `venn.toml`.
 */
export function createNodeModuleIo(roots: Roots): ModuleIo {
  return {
    read: (uri) => readFile(uri, "utf8"),
    resolve: (base, spec) => resolveSpec(spec, base, roots),
  };
}

/**
 * Where a specifier leads on this disk.
 *
 * An extension names a file and no extension names a folder, so `./cart` is
 * read as `./cart/mod.vn` before anything touches the disk. The rule is the
 * language's rather than this host's, which is why it comes from the kernel:
 * the editor resolves the same string the same way.
 */
function resolveSpec(spec: string, base: string, roots: Roots): string {
  const written = moduleFileOf(spec);
  if (spec.startsWith(".")) return resolve(dirname(base), written);
  const alias = resolveAlias({ spec: written, paths: roots.paths });
  return alias ? resolve(roots.rootDir, alias.dir, alias.rest) : spec;
}

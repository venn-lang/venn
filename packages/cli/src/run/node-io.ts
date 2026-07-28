import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveAlias } from "@venn/contracts";
import type { ModuleIo } from "@venn/runtime";

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

function resolveSpec(spec: string, base: string, roots: Roots): string {
  if (spec.startsWith(".")) return resolve(dirname(base), spec);
  const alias = resolveAlias({ spec, paths: roots.paths });
  return alias ? resolve(roots.rootDir, alias.dir, alias.rest) : spec;
}

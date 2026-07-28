import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { NpmModules } from "@venn/runtime";

/**
 * Loading an installed package, the way Node loads one.
 *
 * Resolution is Node's own, rooted at `target/`, the directory holding the
 * generated `package.json` and the `node_modules` beside it. `exports` maps,
 * conditions, scoped names and the rest are what a package means, and a second
 * implementation of them would agree with Node right up until it did not.
 */
export function createNpmLoader(args: { root: string }): NpmModules {
  const target = join(args.root, "target");
  const from = createRequire(pathToFileURL(join(target, "package.json")));
  return {
    async load(spec) {
      const found = resolvePath(from, spec);
      if (!found) return undefined;
      return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
    },
  };
}

type Resolver = { resolve: (spec: string) => string };

/**
 * Where the package lives, or nothing when it is not installed.
 *
 * Not installed is an ordinary state: the manifest asks for a package and
 * nobody has run `venn install` yet. The import that named it reports that
 * itself, which is a better place to say it than inside a resolver.
 */
function resolvePath(from: Resolver, spec: string): string | undefined {
  try {
    return from.resolve(spec);
  } catch {
    return undefined;
  }
}

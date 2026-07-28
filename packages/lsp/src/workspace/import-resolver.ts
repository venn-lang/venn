import { readFileSync } from "node:fs";
import {
  createTomlManifest,
  dotenvFiles,
  parseDotenv,
  resolveAlias,
  tomlDocs,
} from "@venn/contracts";
import type { TypeSpec } from "@venn/types";
import { type URI, UriUtils } from "langium";

/**
 * Reads the nearest `venn.toml` and answers the project-level questions that
 * depend on it: where an import points, and how this project formats.
 */
export interface ImportResolver {
  resolve(spec: string, base: URI): URI;
  /** The `[paths]` aliases visible from a file, and the folder each maps to. */
  aliases(base: URI): Record<string, URI>;
  /** The raw `[format]` table, for {@link formatOptionsFrom}. */
  formatSettings(base: URI): Record<string, unknown>;
  /** Every variable the project declares: `[env.*]` and the dotenv files. */
  env(base: URI): Record<string, Record<string, string>>;
  /** The comment written above each key in `venn.toml`, as its documentation. */
  envDocs(base: URI): Record<string, string>;
  /**
   * What an installed package publishes, derived at install into `target/types/`.
   *
   * Read here rather than derived here: deriving means loading the TypeScript
   * compiler and reading a package's whole declaration graph, which is a second
   * of work and cannot happen on a keystroke. Nothing installed, or nothing
   * derived yet, means an imported name is `dynamic`, which is the truth about
   * it and not a failure.
   */
  packageTypes(base: URI, packages: readonly string[]): Map<string, Record<string, TypeSpec>>;
}

interface Manifested {
  root: URI;
  paths: Record<string, string>;
  format: Record<string, unknown>;
  env: Record<string, Record<string, string>>;
  docs: Record<string, string>;
}

const MAX_DEPTH = 12;

/**
 * Relative specifiers resolve against the importing file; `#alias/…` resolves
 * through the nearest `venn.toml`, searched upwards and cached per directory.
 */
export function createImportResolver(): ImportResolver {
  const cache = new Map<string, Manifested | undefined>();
  return {
    resolve(spec, base) {
      const from = UriUtils.dirname(base);
      if (spec.startsWith(".")) return UriUtils.resolvePath(from, spec);
      const found = findManifest(from, cache);
      const alias = found && resolveAlias({ spec, paths: found.paths });
      if (!found || !alias) return UriUtils.resolvePath(from, spec);
      return UriUtils.resolvePath(found.root, alias.dir, alias.rest);
    },
    aliases(base) {
      const found = findManifest(UriUtils.dirname(base), cache);
      if (!found) return {};
      return Object.fromEntries(
        Object.entries(found.paths).map(([key, dir]) => [
          key,
          UriUtils.resolvePath(found.root, dir),
        ]),
      );
    },
    formatSettings(base) {
      return findManifest(UriUtils.dirname(base), cache)?.format ?? {};
    },
    env(base) {
      return findManifest(UriUtils.dirname(base), cache)?.env ?? {};
    },
    packageTypes(base, packages) {
      const found = findManifest(UriUtils.dirname(base), cache);
      const out = new Map<string, Record<string, TypeSpec>>();
      if (!found) return out;
      for (const name of packages) {
        const at = UriUtils.resolvePath(found.root, "target", "types", `${fileName(name)}.json`);
        const derived = readDerived(at);
        if (derived) out.set(name, derived);
      }
      return out;
    },
    envDocs(base) {
      return findManifest(UriUtils.dirname(base), cache)?.docs ?? {};
    },
  };
}

function findManifest(
  dir: URI,
  cache: Map<string, Manifested | undefined>,
): Manifested | undefined {
  const key = dir.toString();
  if (cache.has(key)) return cache.get(key);
  const found = search(dir);
  cache.set(key, found);
  return found;
}

function search(start: URI): Manifested | undefined {
  let dir = start;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const manifest = read(UriUtils.resolvePath(dir, "venn.toml"));
    if (manifest) return { root: dir, ...manifest, env: withDotenv(dir, manifest) };
    const parent = UriUtils.dirname(dir);
    if (parent.toString() === dir.toString()) return undefined;
    dir = parent;
  }
  return undefined;
}

/**
 * What each environment holds once the dotenv files are folded in.
 *
 * The editor has to show what a run would see, and a run reads `.env` as well
 * as `venn.toml`. `dotenvFiles` is the same list the runner walks, so the two
 * cannot disagree about where a value lives. Only the environment the process
 * was started with is left out: that belongs to whoever launches the program,
 * not to the file being edited.
 */
function withDotenv(dir: URI, manifest: Manifested0): Record<string, Record<string, string>> {
  const names = new Set([...Object.keys(manifest.env), "local"]);
  const out: Record<string, Record<string, string>> = {};
  for (const name of names) {
    out[name] = { ...(manifest.env[name] ?? {}), ...readDotenv(dir, manifest.files, name) };
  }
  return out;
}

function readDotenv(dir: URI, configured: readonly string[], name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of dotenvFiles({ configured, name })) {
    const content = readText(UriUtils.resolvePath(dir, file));
    if (content !== undefined) Object.assign(out, parseDotenv(content));
  }
  return out;
}

function readText(uri: URI): string | undefined {
  try {
    return readFileSync(uri.fsPath, "utf8");
  } catch {
    return undefined;
  }
}

/** What {@link read} returns, before the dotenv files are folded into it. */
type Manifested0 = Omit<Manifested, "root"> & { files: readonly string[] };

function read(uri: URI): Manifested0 | undefined {
  try {
    const content = readFileSync(uri.fsPath, "utf8");
    const manifest = createTomlManifest({ content }).load();
    return {
      paths: manifest.paths,
      format: manifest.format as Record<string, unknown>,
      env: manifest.env,
      files: manifest.envFiles,
      docs: tomlDocs(content),
    };
  } catch {
    return undefined;
  }
}

/** A scope holds a slash and a file name cannot: `@types/node` becomes `@types__node`. */
function fileName(name: string): string {
  return name.replace("/", "__");
}

function readDerived(uri: URI): Record<string, TypeSpec> | undefined {
  try {
    const parsed = JSON.parse(readFileSync(uri.fsPath, "utf8")) as {
      exports?: Record<string, TypeSpec>;
    };
    return parsed.exports;
  } catch {
    return undefined;
  }
}

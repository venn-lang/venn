import { readFileSync } from "node:fs";
import {
  createTomlManifest,
  dotenvFiles,
  type Manifest,
  parseDotenv,
  resolveAlias,
  tomlDocs,
} from "@venn-lang/contracts";
import { moduleFileOf } from "@venn-lang/core";
import { asMember, matchesMember, relativeTo } from "@venn-lang/project";
import type { TypeSpec } from "@venn-lang/types";
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
    // An extension names a file and no extension names a folder, by the
    // kernel's rule, so the editor resolves what the runner resolves.
    resolve(spec, base) {
      const from = UriUtils.dirname(base);
      const written = moduleFileOf(spec);
      if (spec.startsWith(".")) return UriUtils.resolvePath(from, written);
      const found = findManifest(from, cache);
      const alias = found && resolveAlias({ spec: written, paths: found.paths });
      if (!found || !alias) return UriUtils.resolvePath(from, written);
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

/**
 * The project governing a directory, workspace inheritance applied.
 *
 * Applied here rather than skipped, because a member reads the `[env.*]` and
 * the `[paths]` its root declared: without this the editor drew a `VN2006` over
 * every root-declared variable and resolved every `#alias` to a path nothing is
 * indexed at, on code `venn check` and `venn run` both accept.
 */
function search(start: URI): Manifested | undefined {
  const found = nearest(start);
  if (!found) return undefined;
  const owner = owningWorkspace(found.dir);
  const manifest = owner
    ? asMember({
        manifest: found.read.manifest,
        dir: found.dir.fsPath,
        from: owner.manifest,
        fromDir: owner.dir.fsPath,
      })
    : found.read.manifest;
  return settled({ dir: found.dir, manifest, docs: found.read.docs });
}

function settled(args: { dir: URI; manifest: Manifest; docs: Docs }): Manifested {
  const reduced: Manifested0 = {
    paths: args.manifest.paths,
    format: args.manifest.format as Record<string, unknown>,
    env: args.manifest.env,
    files: args.manifest.envFiles,
    docs: args.docs,
  };
  return { root: args.dir, ...reduced, env: withDotenv(args.dir, reduced) };
}

/** The nearest `venn.toml` at or above a directory, with where it sits. */
function nearest(start: URI): { dir: URI; read: Read } | undefined {
  let dir = start;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const found = read(UriUtils.resolvePath(dir, "venn.toml"));
    if (found) return { dir, read: found };
    const parent = UriUtils.dirname(dir);
    if (parent.toString() === dir.toString()) return undefined;
    dir = parent;
  }
  return undefined;
}

/**
 * The nearest workspace above this package that lists it among its members.
 *
 * Matched against the patterns as text rather than by expanding them on disk:
 * this runs on a keystroke, and whether `packages/*` would catch a directory
 * does not need that directory read. The CLI expands them and drops a match
 * holding no manifest, which changes nothing here: this one has one.
 */
function owningWorkspace(from: URI): { dir: URI; manifest: Manifest } | undefined {
  let dir = UriUtils.dirname(from);
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const found = read(UriUtils.resolvePath(dir, "venn.toml"));
    if (claims(found?.manifest, from, dir)) return { dir, manifest: found.manifest };
    const parent = UriUtils.dirname(dir);
    if (parent.toString() === dir.toString()) return undefined;
    dir = parent;
  }
  return undefined;
}

function claims(
  manifest: Manifest | undefined,
  member: URI,
  root: URI,
): manifest is Manifest & { workspace: { members: readonly string[] } } {
  const patterns = manifest?.workspace?.members;
  if (!patterns) return false;
  return matchesMember({ path: relativeTo(member.fsPath, root.fsPath), patterns });
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

/** What the editor keeps of a manifest, before the dotenv files are folded in. */
type Manifested0 = Omit<Manifested, "root"> & { files: readonly string[] };

/** The comment written above each key, which `venn.toml` alone carries. */
type Docs = Record<string, string>;

/** One `venn.toml`, whole, because inheritance is applied over the whole thing. */
interface Read {
  manifest: Manifest;
  docs: Docs;
}

function read(uri: URI): Read | undefined {
  try {
    const content = readFileSync(uri.fsPath, "utf8");
    return { manifest: createTomlManifest({ content }).load(), docs: tomlDocs(content) };
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

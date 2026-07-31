import {
  type Document,
  type FragmentDecl,
  type ImportedDeco,
  isDecoDecl,
  isFragmentDecl,
  isPackageSpecifier,
  isUseDecl,
  isValueImport,
  parse,
} from "@venn-lang/core";

/** Read source by URI and resolve a specifier relative to a base URI. */
export interface ModuleIo {
  read: (uri: string) => Promise<string>;
  resolve: (base: string, spec: string) => string;
}

/**
 * Loading a package that was installed rather than written here.
 *
 * Kept apart from {@link ModuleIo} because the two answer different questions:
 * one reads `.vn` source to be parsed, the other hands back a module that is
 * already a value. A host without one simply has no packages, which is the state
 * of every run in a Web Worker and not an error.
 */
export interface NpmModules {
  load(spec: string): Promise<Record<string, unknown> | undefined>;
}

/** What a run needs from the files it reaches: their fragments, decos and plugins. */
export interface ResolvedImports {
  fragments: Map<string, FragmentDecl>;
  /** The `pub deco`s reachable through the import graph, with the file each came from. */
  decos: Map<string, ImportedDeco>;
  /** Every package `use`d anywhere in the graph, so only those need loading. */
  packages: Set<string>;
  /**
   * What each npm specifier loaded to, by the name that was written.
   *
   * Loaded here, before anything runs, because binding a scope cannot wait: by
   * the time a name is looked up the module has to already be a value.
   */
  npm: Map<string, Record<string, unknown>>;
  /**
   * Every module reached, parsed, keyed by its resolved URI.
   *
   * Carried whole rather than reduced to a list of exported names, because a
   * `pub fn` is a closure over the file it was written in: it calls that file's
   * private helpers and reads that file's globals. Handing over the function
   * without the place it came from produces something that resolves and then
   * fails on its first line.
   */
  modules: Map<string, Document>;
}

/**
 * Walk the import graph from one document, parsing every `.vn` file it reaches
 * and loading every package it names. A file already seen is skipped, so a cycle
 * ends rather than loops. A file that cannot be read is skipped in silence:
 * whoever tried to read it reports the failure.
 *
 * @param args The entry document, its URI, the source reader and the optional
 * package loader.
 * @returns The exported fragments and decos, the packages, the loaded npm
 * modules and every parsed document, keyed by resolved URI.
 */
export async function resolveImports(args: {
  document: Document;
  uri: string;
  io: ModuleIo;
  /** Absent when the host has no way to load one: a Worker, most tests. */
  npm?: NpmModules;
}): Promise<ResolvedImports> {
  const found: Exports = { fragments: new Map(), decos: new Map() };
  const packages = new Set<string>();
  const modules = new Map<string, Document>();
  const npm = new Map<string, Record<string, unknown>>();
  collectUses(args.document, packages);
  await loadInto({
    document: args.document,
    uri: args.uri,
    io: args.io,
    npmLoader: args.npm,
    found,
    packages,
    modules,
    npm,
    seen: new Set([args.uri]),
  });
  return { ...found, packages, modules, npm };
}

/**
 * Add the packages a file declares with `use` to `into`. Collected across the
 * whole graph: a fragment imported from elsewhere calls the verbs *its* file
 * asked for.
 *
 * @param document The file to read `use` declarations from.
 * @param into The accumulating set of package specifiers, mutated in place.
 */
export function collectUses(document: Document, into: Set<string>): void {
  for (const decl of document.imports) {
    if (isUseDecl(decl)) into.add(decl.pkg);
    // An import of a package is a package this run needs, the same as a `use`
    // was: which of the two it turns out to be is the registry's business.
    else if (isValueImport(decl) && isPackageSpecifier(decl.path)) into.add(decl.path);
  }
}

/** What `pub` has handed over so far, filled as the graph is walked. */
interface Exports {
  fragments: Map<string, FragmentDecl>;
  decos: Map<string, ImportedDeco>;
}

interface LoadState {
  document: Document;
  uri: string;
  io: ModuleIo;
  npmLoader?: NpmModules;
  found: Exports;
  packages: Set<string>;
  modules: Map<string, Document>;
  npm: Map<string, Record<string, unknown>>;
  seen: Set<string>;
}

async function loadInto(state: LoadState): Promise<void> {
  for (const decl of state.document.imports) {
    if (!isValueImport(decl)) continue;
    if (isPackageSpecifier(decl.path)) await loadPackage(state, decl.path);
    else await loadModule(state, decl.path);
  }
}

/**
 * A package that was installed, loaded once however many files name it.
 *
 * A host with no loader has no packages, which is the state of every run in a
 * Web Worker. The import is left unbound and the name reports itself as unknown,
 * rather than the load failing somewhere nobody can see.
 */
async function loadPackage(state: LoadState, spec: string): Promise<void> {
  if (state.npm.has(spec) || !state.npmLoader) return;
  const found = await state.npmLoader.load(spec).catch(() => undefined);
  if (found) state.npm.set(spec, found);
}

async function loadModule(state: LoadState, spec: string): Promise<void> {
  const target = state.io.resolve(state.uri, spec);
  if (state.seen.has(target)) return;
  state.seen.add(target);
  const source = await state.io.read(target).catch(() => undefined);
  if (source === undefined) return;
  const { ast } = parse(source, { uri: target });
  state.modules.set(target, ast);
  collectExports({ document: ast, uri: target, found: state.found });
  collectUses(ast, state.packages);
  await loadInto({ ...state, document: ast, uri: target });
}

/** Everything a file marked `pub`. A `deco` keeps its file: its faults are its own. */
function collectExports(args: { document: Document; uri: string; found: Exports }): void {
  for (const decl of args.document.decls) {
    if (isFragmentDecl(decl) && decl.export) args.found.fragments.set(decl.name, decl);
    if (isDecoDecl(decl) && decl.export) args.found.decos.set(decl.name, { decl, uri: args.uri });
  }
}

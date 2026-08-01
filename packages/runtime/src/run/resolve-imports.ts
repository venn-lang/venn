import {
  type Document,
  type FragmentDecl,
  type ImportedDeco,
  isDecoDecl,
  isFragmentDecl,
  isPackageSpecifier,
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

/**
 * A specifier that named a file, and a file that was not there.
 *
 * The path tried is carried because it is the whole of what a reader needs: the
 * specifier is what they wrote, and the resolved path is where it led, and the
 * gap between the two is the mistake.
 */
export interface UnreadableImport {
  /** As written in the file. */
  spec: string;
  /** The file that wrote it. */
  from: string;
  /** Where it resolved to, and where nothing was. */
  tried: string;
}

/**
 * Files that import each other, in the order they do it.
 *
 * The last name is the first again: `["a.vn", "b.vn", "a.vn"]` is a's import of
 * b and b's import back. The import that closes it is the one worth pointing at,
 * because it is the one that could be moved.
 */
export interface ImportCycle {
  /** Every file on the way round, starting and ending at the same one. */
  path: readonly string[];
  /** The file whose import closes it, which is the last but one on the path. */
  closedBy: string;
  /** The specifier that closed it, as written. */
  spec: string;
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
  /**
   * Every import that named a file nothing could be read from.
   *
   * Only this walk knows: it resolved the path and asked for it. Whoever holds
   * the graph afterwards sees an absent module and cannot tell "not there" from
   * "not looked at", which is why this is carried rather than re-derived.
   */
  unreadable: readonly UnreadableImport[];
  /**
   * Every set of files that import each other.
   *
   * A `const` at the top of a file is evaluated when the file is, and a `pub fn`
   * closes over the file it was written in, so there is no hoisting to hide
   * behind: one side of a cycle reads bindings the other has not filled yet, and
   * which side depends on which file the run happened to enter first.
   */
  cycles: readonly ImportCycle[];
}

/**
 * Walk the import graph from one document, parsing every `.vn` file it reaches
 * and loading every package it names. A file already seen is skipped, so a cycle
 * ends rather than loops. A file that cannot be read is recorded rather than
 * skipped, since only this walk knows a path was tried and answered nothing.
 *
 * @param args The entry document, its URI, the source reader and the optional
 * package loader.
 * @returns The exported fragments and decos, the packages, the loaded npm
 * modules, every parsed document keyed by resolved URI, and every specifier
 * that named a file nothing could be read from.
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
  const unreadable: UnreadableImport[] = [];
  const cycles: ImportCycle[] = [];
  collectPackages(args.document, packages);
  await loadInto({
    document: args.document,
    uri: args.uri,
    io: args.io,
    npmLoader: args.npm,
    found,
    packages,
    modules,
    npm,
    unreadable,
    cycles,
    open: [{ uri: args.uri }],
    seen: new Set([args.uri]),
  });
  return { ...found, packages, modules, npm, unreadable, cycles };
}

/**
 * Add the packages a file imports to `into`. Collected across the whole graph: a
 * fragment imported from elsewhere calls the verbs *its* file asked for.
 *
 * @param document The file to read imports from.
 * @param into The accumulating set of package specifiers, mutated in place.
 */
export function collectPackages(document: Document, into: Set<string>): void {
  for (const decl of document.imports) {
    if (isValueImport(decl) && isPackageSpecifier(decl.path)) into.add(decl.path);
  }
}

/**
 * The cycle as one answer, whichever file the walk entered from.
 *
 * The same three files import each other whether the walk started at the first,
 * the second or the third, and each entry finds the circle closing at a
 * different door. Rotated to start at the same file every time, so `venn check`
 * over a folder reports one mistake rather than one per file that leads into it.
 *
 * @param hops The way round, the last being the file the first also is.
 */
function circleOf(hops: readonly Hop[]): ImportCycle {
  const round = hops.slice(0, -1);
  const first = round.reduce((low, hop) => (hop.uri < low.uri ? hop : low), round[0] as Hop);
  const from = round.indexOf(first);
  const turned = [...round.slice(from), ...round.slice(0, from)];
  const closing = turned[turned.length - 1] as Hop;
  return {
    path: [...turned.map((hop) => hop.uri), first.uri],
    closedBy: closing.uri,
    spec: hops.slice(1).find((hop) => hop.uri === first.uri)?.spec ?? (first.spec as string),
  };
}

/** What `pub` has handed over so far, filled as the graph is walked. */
interface Exports {
  fragments: Map<string, FragmentDecl>;
  decos: Map<string, ImportedDeco>;
}

/** One file on the way in, and the specifier that reached it. */
interface Hop {
  uri: string;
  /** Absent for the file the walk started at, which nothing reached. */
  spec?: string;
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
  unreadable: UnreadableImport[];
  cycles: ImportCycle[];
  /**
   * The files being loaded right now, outermost first, each with the specifier
   * that led to it. The way back to here, and how each step was written.
   */
  open: Hop[];
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
  // On the way back to a file still being loaded, rather than merely to one
  // already loaded: two files importing the same third is not a cycle.
  const at = state.open.findIndex((hop) => hop.uri === target);
  if (at !== -1) {
    state.cycles.push(circleOf([...state.open.slice(at), { uri: target, spec }]));
    return;
  }
  if (state.seen.has(target)) return;
  state.seen.add(target);
  const source = await state.io.read(target).catch(() => undefined);
  // Recorded, not raised: one unreadable import is not a reason to stop reading
  // the rest, and a file with three bad paths should hear about all three.
  if (source === undefined) {
    state.unreadable.push({ spec, from: state.uri, tried: target });
    return;
  }
  const { ast } = parse(source, { uri: target });
  state.modules.set(target, ast);
  collectExports({ document: ast, uri: target, found: state.found });
  collectPackages(ast, state.packages);
  await loadInto({
    ...state,
    document: ast,
    uri: target,
    open: [...state.open, { uri: target, spec }],
  });
}

/** Everything a file marked `pub`. A `deco` keeps its file: its faults are its own. */
function collectExports(args: { document: Document; uri: string; found: Exports }): void {
  for (const decl of args.document.decls) {
    if (isFragmentDecl(decl) && decl.export) args.found.fragments.set(decl.name, decl);
    if (isDecoDecl(decl) && decl.export) args.found.decos.set(decl.name, { decl, uri: args.uri });
  }
}

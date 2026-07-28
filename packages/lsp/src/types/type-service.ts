import {
  type AstNode,
  checkTypes,
  type Document,
  type Expr,
  type ImportedDeco,
  importedTypes,
  isPackageSpecifier,
  isValueImport,
  type Problem,
  type Type,
  type TypeCatalog,
} from "@venn-lang/core";
import { createTypeCatalog } from "@venn-lang/runtime";
import { allPlugins } from "@venn-lang/stdlib";
import type { TypeSpec } from "@venn-lang/types";
import type { LangiumDocument } from "langium";
import { importedDecos } from "../deco/index.js";
import { importedModules, type ModuleGraph } from "../document/index.js";
import type { VennServices } from "../services/lsp.types.js";

/** What inference found for one document: its type errors and every node's type. */
export interface DocumentTypes {
  problems: readonly Problem[];
  types: ReadonlyMap<AstNode, Type>;
  /**
   * Per string literal, the expression inference parsed from each `${…}`. The
   * document's own tree stops at the string, so these are the only nodes the
   * editor can reach for code written inside one.
   */
  slots: ReadonlyMap<AstNode, readonly (Expr | undefined)[]>;
}

/**
 * Type information for the workspace, computed once per parse of a document.
 *
 * Inference walks a whole file, and several features want its result:
 * diagnostics on every edit, hover on every mouse move. Without a shared cache
 * the same file is re-checked many times per keystroke; with it, a file is
 * checked once when it changes and every reader is served from memory.
 */
export interface TypeService {
  /** Everything inference knows about this document, cached until it is reparsed. */
  of(document: LangiumDocument): DocumentTypes;
  /** What is already cached, or undefined, for readers that must not block. */
  peek(document: LangiumDocument): DocumentTypes | undefined;
  /** Forget a document: it was deleted, or its folder was closed. */
  forget(uri: string): void;
}

const EMPTY: DocumentTypes = { problems: [], types: new Map(), slots: new Map() };

interface Entry {
  /** The AST this was computed from. A reparse yields a new root, so a stale
   * entry can never be mistaken for a fresh one. A version number could be,
   * since replacing a document resets it to zero. */
  root: object;
  result: DocumentTypes;
}

export function createTypeService(services: VennServices): TypeService {
  const cache = new Map<string, Entry>();
  // Built once: reading every plugin's published types on each keystroke would
  // be work the answer never changes for.
  const catalog = createTypeCatalog(allPlugins);
  return {
    of(document) {
      const cached = hit(cache, document);
      if (cached) return cached;
      const root = document.parseResult?.value;
      const result = compute({ document, catalog, ...outside(document, services) });
      if (root) cache.set(document.uri.toString(), { root, result });
      return result;
    },
    peek: (document) => hit(cache, document),
    forget: (uri) => void cache.delete(uri),
  };
}

/**
 * The `pub deco`s this file imports.
 *
 * Read here rather than in {@link compute} because the services are resolved
 * lazily: touching them while the module is still being built would close a
 * loop that only opens once everything is constructed.
 */
function outside(
  document: LangiumDocument,
  services: VennServices,
): {
  decos?: Map<string, ImportedDeco>;
  graph?: ModuleGraph;
  packages?: Map<string, Record<string, TypeSpec>>;
} {
  const root = document.parseResult?.value as Document | undefined;
  if (!root) return {};
  const scope = {
    root,
    uri: document.uri,
    documents: services.shared.workspace.LangiumDocuments,
    imports: services.imports,
  };
  return {
    decos: importedDecos(scope),
    graph: importedModules(scope),
    packages: services.imports.packageTypes(document.uri, packagesNamed(root)),
  };
}

/** The bare specifiers this file imports: the ones that name a package. */
function packagesNamed(root: Document): string[] {
  return root.imports
    .filter(isValueImport)
    .map((decl) => decl.path)
    .filter(isPackageSpecifier);
}

function hit(cache: Map<string, Entry>, document: LangiumDocument): DocumentTypes | undefined {
  const entry = cache.get(document.uri.toString());
  return entry && entry.root === document.parseResult?.value ? entry.result : undefined;
}

function compute(args: {
  document: LangiumDocument;
  catalog: TypeCatalog;
  decos?: Map<string, ImportedDeco>;
  graph?: ModuleGraph;
  packages?: Map<string, Record<string, TypeSpec>>;
}): DocumentTypes {
  const { document, catalog, decos, graph } = args;
  const root = document.parseResult?.value as Document | undefined;
  if (!root) return EMPTY;
  const uri = document.uri.toString();
  // What the imported names are, worked out from the files they were written
  // in, so an imported function has a hover and its arguments are checked.
  const imports =
    graph && importedTypes({ ...graph, document: root, uri, catalog, packages: args.packages });
  const checked = checkTypes(root, { uri, catalog, decos, imports });
  return {
    problems: checked.problems,
    types: checked.types as ReadonlyMap<AstNode, Type>,
    slots: checked.slots as ReadonlyMap<AstNode, readonly (Expr | undefined)[]>,
  };
}

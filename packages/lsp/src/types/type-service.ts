import { ALL_CAPABILITIES } from "@venn-lang/contracts";
import { type Document, isPackageSpecifier, isValueImport } from "@venn-lang/core";
import {
  type AnalyzeArgs,
  collectFragments,
  createFrontEnd,
  type FrontEnd,
} from "@venn-lang/runtime";
import { allPlugins } from "@venn-lang/stdlib";
import type { LangiumDocument } from "langium";
import { importedDecos } from "../deco/index.js";
import { importedFragments, importedModules, type ModuleGraph } from "../document/index.js";
import { declaredEnv } from "../env/index.js";
import type { VennServices } from "../services/lsp.types.js";
import type { DocumentTypes, TypeService } from "./type-service.types.js";

const EMPTY: DocumentTypes = { problems: [], types: new Map(), slots: new Map() };

interface Entry {
  /** The AST this was computed from. A reparse yields a new root, so a stale
   * entry can never be mistaken for a fresh one. A version number could be,
   * since replacing a document resets it to zero. */
  root: object;
  result: DocumentTypes;
}

/**
 * The editor's analysis cache: one front end, one result per parse.
 *
 * Every capability there is, deliberately. An editor describes the language
 * rather than one run of it, so a verb some host could not supply is still a
 * verb, and refusing it here would draw a red line under correct code.
 *
 * @param services The Langium services, for the workspace index and the
 * project resolver.
 * @returns The service the validator, hover, completion and signature help all
 * read a document's analysis from.
 */
export function createTypeService(services: VennServices): TypeService {
  const cache = new Map<string, Entry>();
  // Built once: reading every plugin's published types on each keystroke would
  // be work the answer never changes for.
  const front = createFrontEnd({ plugins: allPlugins, caps: ALL_CAPABILITIES });
  return {
    of(document) {
      const cached = hit(cache, document);
      if (cached) return cached;
      const root = document.parseResult?.value;
      const result = compute(document, services, front);
      if (root) cache.set(document.uri.toString(), { root, result });
      return result;
    },
    peek: (document) => hit(cache, document),
    forget: (uri) => void cache.delete(uri),
  };
}

function hit(cache: Map<string, Entry>, document: LangiumDocument): DocumentTypes | undefined {
  const entry = cache.get(document.uri.toString());
  return entry && entry.root === document.parseResult?.value ? entry.result : undefined;
}

function compute(
  document: LangiumDocument,
  services: VennServices,
  front: FrontEnd,
): DocumentTypes {
  const root = document.parseResult?.value as Document | undefined;
  return root ? front.analyze(inputsFor(root, document, services)) : EMPTY;
}

/**
 * What the workspace knows about this file's surroundings.
 *
 * Read here rather than when the service is built, because the services are
 * resolved lazily: touching them while the module is still being constructed
 * would close a loop that only opens once everything is.
 */
function inputsFor(root: Document, document: LangiumDocument, services: VennServices): AnalyzeArgs {
  const uri = document.uri.toString();
  const scope = {
    root,
    uri: document.uri,
    documents: services.shared.workspace.LangiumDocuments,
    imports: services.imports,
  };
  const graph = importedModules(scope);
  return {
    document: root,
    uri,
    graph,
    decos: importedDecos(scope),
    fragments: knownFragments(root, uri, graph),
    env: declaredEnv(services.imports, document),
    packages: services.imports.packageTypes(document.uri, packagesNamed(root)),
    // Both empty on purpose. A neighbour the workspace has not indexed yet is
    // not a file that is missing, and drawing an error over one still loading
    // is worse than saying nothing until the next build.
    unreadable: [],
    cycles: [],
  };
}

/**
 * A fragment is known if this file declares one or imported one.
 *
 * Only real fragments count: the neighbouring files say which imported names
 * are fragments, so `run` cannot accept a `pub fn` by mistake.
 */
function knownFragments(document: Document, uri: string, graph: ModuleGraph): Set<string> {
  const imported = importedFragments({ document, uri, graph });
  return new Set([...collectFragments(document).keys(), ...imported]);
}

/** The bare specifiers this file imports: the ones that name a package. */
function packagesNamed(root: Document): string[] {
  return root.imports
    .filter(isValueImport)
    .map((decl) => decl.path)
    .filter(isPackageSpecifier);
}

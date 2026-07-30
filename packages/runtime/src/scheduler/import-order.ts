import { type Document, isPackageSpecifier, isValueImport } from "@venn-lang/core";
import type { ImportGraph } from "./bind-imports.js";

/**
 * The modules with the ones they import first.
 *
 * A `pub const` is computed where it stands, so a module whose value reads an
 * imported one has to be filled after the module it read from. Filling them in
 * whatever order a map happens to hold left a chain of two computing against
 * `undefined`.
 *
 * @param graph The modules, and how one names another.
 * @returns Every module, each after everything it imports.
 */
export function inDependencyOrder(graph: ImportGraph): [string, Document][] {
  const ordered: [string, Document][] = [];
  const seen = new Set<string>();
  for (const uri of graph.modules.keys()) visit({ uri, graph, seen, ordered });
  return ordered;
}

/**
 * Depth first, marking on the way in.
 *
 * Marking before recursing is what makes a cycle terminate. Two modules that
 * import each other have no order that satisfies both, and one of them will read
 * the other's value before it exists. That is true of every language with
 * top-level bindings, and the answer is the same: do not do that.
 */
function visit(args: {
  uri: string;
  graph: ImportGraph;
  seen: Set<string>;
  ordered: [string, Document][];
}): void {
  const { uri, graph, seen, ordered } = args;
  if (seen.has(uri)) return;
  seen.add(uri);
  const module = graph.modules.get(uri);
  if (!module) return;
  for (const from of importedBy({ module, uri, graph })) {
    visit({ uri: from, graph, seen, ordered });
  }
  ordered.push([uri, module]);
}

/** The files this one imports, as the uris the graph knows them by. */
function importedBy(args: { module: Document; uri: string; graph: ImportGraph }): string[] {
  const found: string[] = [];
  for (const decl of args.module.imports) {
    if (!isValueImport(decl) || isPackageSpecifier(decl.path)) continue;
    found.push(args.graph.resolve(args.uri, decl.path));
  }
  return found;
}

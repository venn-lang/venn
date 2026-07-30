import {
  buildProblem,
  CODES,
  type Document,
  isDecoDecl,
  isFnDecl,
  isFragmentDecl,
  isLetStmt,
  isTypeDecl,
  isValueImport,
  type Problem,
  type ValueImport,
} from "@venn-lang/core";
import type { ImportGraph } from "../scheduler/index.js";
import { nodeSpan } from "../scheduler/index.js";

/**
 * Check every name a file imports against what the file it names publishes.
 * Otherwise a misspelt import stays quietly `undefined` until something calls
 * it, and the run blames the call site rather than the import.
 *
 * @param args The importing document, its URI, and the resolved import graph.
 * @returns One `VN2009` problem per name the target does not publish.
 */
export function checkImports(args: {
  document: Document;
  uri: string;
  graph: ImportGraph;
}): Problem[] {
  const problems: Problem[] = [];
  for (const decl of args.document.imports) {
    if (!isValueImport(decl)) continue;
    const target = args.graph.resolve(args.uri, decl.path);
    const module = args.graph.modules.get(target);
    // A path that reads nothing is already reported by whoever tried to read it.
    if (module) problems.push(...missing({ decl, module, uri: args.uri, path: decl.path }));
  }
  return problems;
}

function missing(args: {
  decl: ValueImport;
  module: Document;
  uri: string;
  path: string;
}): Problem[] {
  const published = exported(args.module);
  return args.decl.names
    .filter((name) => !published.has(name))
    .map((name) =>
      buildProblem({
        spec: CODES.VN2009_NOT_EXPORTED,
        span: nodeSpan(args.decl, args.uri),
        title: `"${args.path}" does not publish ${name}.`,
        note: hint(name, args.module),
      }),
    );
}

/**
 * Why it is not there: written but kept private, or not written at all. The two
 * are different mistakes with different fixes, and a reader told only "not
 * published" goes looking for a typo they did not make.
 */
function hint(name: string, module: Document): string {
  const declared = module.decls.some(
    (decl) => publishable(decl) && (decl as { name?: string }).name === name,
  );
  return declared
    ? `It is declared there, but not marked \`pub\`.`
    : `Nothing of that name is declared there.`;
}

/**
 * What a file marked `pub`.
 *
 * Everything that has a name and can be used from elsewhere: a function, a
 * fragment, a decorator, a type, and a binding. A type and a binding are what
 * make a shared vocabulary possible, which is the whole reason a file boundary
 * exists rather than a convention about copying declarations.
 */
function exported(document: Document): Set<string> {
  const names = new Set<string>();
  for (const decl of document.decls) {
    if (publishable(decl) && decl.export) names.add(decl.name);
  }
  return names;
}

/** The declarations `pub` means something on. */
function publishable(decl: unknown): decl is { name: string; export?: boolean } {
  return (
    isFnDecl(decl) ||
    isFragmentDecl(decl) ||
    isDecoDecl(decl) ||
    isTypeDecl(decl) ||
    isLetStmt(decl)
  );
}

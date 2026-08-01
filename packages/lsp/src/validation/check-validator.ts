import { ALL_CAPABILITIES } from "@venn-lang/contracts";
import type { Document, Problem, VennAstType } from "@venn-lang/core";
import {
  buildRegistry,
  checkDocument,
  checkImports,
  collectFragments,
  type Registry,
} from "@venn-lang/runtime";
import { allPlugins } from "@venn-lang/stdlib";
import {
  AstUtils,
  type LangiumDocument,
  type LangiumDocuments,
  type ValidationAcceptor,
} from "langium";
import type { Range } from "vscode-languageserver";
import { importedFragments, importedModules, type ModuleGraph } from "../document/index.js";
import { envNames } from "../env/index.js";
import type { VennServices } from "../services/lsp.types.js";
import type { TypeService } from "../types/index.js";
import type { ImportResolver } from "../workspace/index.js";

/** Wire the runtime's static check (VN2003/4/5) into the editor's diagnostics. */
export function registerVennChecks(services: VennServices): void {
  const registry = buildRegistry({ plugins: allPlugins, caps: ALL_CAPABILITIES });
  const imports = services.imports;
  const types = services.types;
  const documents = services.shared.workspace.LangiumDocuments;
  services.validation.ValidationRegistry.register<VennAstType>({
    Document: (document, accept) =>
      report({ document, accept, registry, imports, types, documents }),
  });
}

function report(args: {
  document: Document;
  accept: ValidationAcceptor;
  registry: Registry;
  imports: ImportResolver;
  types: TypeService;
  documents: LangiumDocuments;
}): void {
  const langiumDocument = AstUtils.getDocument(args.document);
  const uri = langiumDocument.uri.toString();
  const graph = importedModules({
    root: args.document,
    uri: langiumDocument.uri,
    documents: args.documents,
    imports: args.imports,
  });
  const fragments = knownFragments({ document: args.document, uri, graph });
  const problems = checkDocument({
    document: args.document,
    registry: args.registry,
    fragments,
    env: declaredEnv(args.imports, langiumDocument),
    uri: langiumDocument.uri.toString(),
  });
  // Type errors come from the shared service, so a file is inferred once per
  // change and hover reads the very same result.
  const typed = args.types.of(langiumDocument).problems;
  const imported = checkImports({ document: args.document, uri, graph });
  for (const problem of [...problems, ...typed, ...imported]) emit(problem, args, langiumDocument);
}

/**
 * The variables `venn.toml` declares, or undefined when there is no manifest.
 * Without one, every `env.*` read would look undeclared.
 */
function declaredEnv(
  imports: ImportResolver,
  document: LangiumDocument,
): readonly string[] | undefined {
  const sections = imports.env(document.uri);
  return Object.keys(sections).length > 0 ? envNames(sections) : undefined;
}

function emit(
  problem: Problem,
  args: { document: Document; accept: ValidationAcceptor },
  langiumDocument: LangiumDocument,
): void {
  args.accept("error", said(problem), {
    node: args.document,
    range: rangeOf(problem, langiumDocument),
    code: problem.code,
  });
}

/**
 * The title, and what the check worked out beneath it.
 *
 * A diagnostic is one string in the protocol, and the editor shows all of it on
 * hover. Dropping the help means the fix a check already knows never reaches
 * the one place it would be acted on.
 */
function said(problem: Problem): string {
  return [problem.title, problem.help, problem.note].filter(Boolean).join("\n");
}

/**
 * A fragment is known if this file declares one or imported one.
 *
 * Only real fragments count: the neighbouring files say which imported names
 * are fragments, so `run` cannot accept a `pub fn` by mistake.
 */
function knownFragments(args: {
  document: Document;
  uri: string;
  graph: ModuleGraph;
}): Set<string> {
  return new Set([...collectFragments(args.document).keys(), ...importedFragments(args)]);
}

function rangeOf(problem: Problem, document: LangiumDocument): Range {
  const text = document.textDocument;
  return {
    start: text.positionAt(problem.span.offset),
    end: text.positionAt(problem.span.offset + problem.span.length),
  };
}

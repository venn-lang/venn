import type { Document, Problem, RelatedInfo, VennAstType } from "@venn-lang/core";
import { AstUtils, type LangiumDocument, type ValidationAcceptor } from "langium";
import type { DiagnosticRelatedInformation, Range } from "vscode-languageserver";
import type { VennServices } from "../services/lsp.types.js";
import type { TypeService } from "../types/index.js";
import { saidProblem, spanRange } from "./said-problem.js";

/**
 * Wire the shared front end into the editor's diagnostics.
 *
 * Every pass the CLI runs, because it is the very same call: the analysis comes
 * from the type service, which caches one `analyze` per parse, so the editor and
 * `venn check` cannot disagree about which checks ran.
 */
export function registerVennChecks(services: VennServices): void {
  const types = services.types;
  services.validation.ValidationRegistry.register<VennAstType>({
    Document: (document, accept) => report({ document, accept, types }),
  });
}

function report(args: {
  document: Document;
  accept: ValidationAcceptor;
  types: TypeService;
}): void {
  const langiumDocument = AstUtils.getDocument(args.document);
  const uri = langiumDocument.uri.toString();
  for (const problem of args.types.of(langiumDocument).problems) {
    // A problem may point at another file, as a cycle does at the one that
    // closes it. Diagnostics are published per document, so one belonging to a
    // neighbour is that neighbour's to draw.
    if (problem.span.uri === uri) emit(problem, args, langiumDocument);
  }
}

function emit(
  problem: Problem,
  args: { document: Document; accept: ValidationAcceptor },
  langiumDocument: LangiumDocument,
): void {
  // The severity the catalogue declared, never a constant. `VN5005` is a hint
  // because an import nobody used is untidy rather than wrong, and the CLI
  // exits 0 on it; publishing it as an error drew a red line under code that
  // passes, which is how people learn to ignore the editor.
  //
  // `codeDescription` makes the code a click through to its page, which is the
  // same URL the terminal prints and a program's `catch` reads.
  args.accept(problem.severity, saidProblem(problem), {
    node: args.document,
    range: spanRange(problem.span, langiumDocument),
    code: problem.code,
    codeDescription: problem.docs ? { href: problem.docs } : undefined,
    ...related(problem, langiumDocument),
  });
}

/**
 * The other place, when a problem is about two places at once.
 *
 * `VN2020` names the declaration this one collides with and `VN2021` names each
 * file on the way round a cycle. A client renders these as a click that takes
 * you there, and the editor is where such a click is worth having.
 */
function related(
  problem: Problem,
  document: LangiumDocument,
): { relatedInformation?: DiagnosticRelatedInformation[] } {
  const found = problem.related ?? [];
  if (found.length === 0) return {};
  return { relatedInformation: found.map((one) => elsewhere(one, document)) };
}

function elsewhere(one: RelatedInfo, document: LangiumDocument): DiagnosticRelatedInformation {
  const here = one.span.uri === document.uri.toString();
  return {
    location: { uri: one.span.uri, range: here ? spanRange(one.span, document) : WHOLE_FILE },
    message: one.label,
  };
}

/** A span in another file, whose text this server may not have loaded. */
const WHOLE_FILE: Range = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
};

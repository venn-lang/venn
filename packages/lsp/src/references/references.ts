import type { LangiumDocument, LangiumDocuments } from "langium";
import type { ReferencesProvider } from "langium/lsp";
import type { Location, ReferenceParams } from "vscode-languageserver";
import type { VennServices } from "../services/lsp.types.js";
import { findOccurrences, locationsOf } from "./find-occurrences.js";
import { symbolAt } from "./symbol-at.js";

/**
 * Shift+F12: every place a name is used.
 *
 * Langium's own provider resolves cross-references the grammar declares, and
 * this grammar declares none: a `run` target is a string, a `@name` is a string,
 * and which `const` a `Ref` means is worked out by walking scopes. So the answer
 * has to be worked out the same way the checker and the evaluator work it out,
 * which is what this shares with them.
 */
export class VennReferencesProvider implements ReferencesProvider {
  private readonly documents: LangiumDocuments;

  constructor(services: VennServices) {
    this.documents = services.shared.workspace.LangiumDocuments;
  }

  findReferences(document: LangiumDocument, params: ReferenceParams): Location[] {
    const symbol = symbolAt(document, params.position);
    if (!symbol) return [];
    const found = findOccurrences({ symbol, document, documents: this.documents });
    const wanted = params.context?.includeDeclaration === false ? uses(found) : found;
    return locationsOf(wanted);
  }
}

/** The editor may ask for the uses without the line that introduces the name. */
function uses(found: ReturnType<typeof findOccurrences>): ReturnType<typeof findOccurrences> {
  return found
    .map((one) => ({ ...one, occurrences: one.occurrences.filter((each) => !each.declaration) }))
    .filter((one) => one.occurrences.length > 0);
}

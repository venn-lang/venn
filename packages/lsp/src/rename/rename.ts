import type { LangiumDocument, LangiumDocuments } from "langium";
import type { RenameProvider } from "langium/lsp";
import type {
  PrepareRenameParams,
  Range,
  RenameParams,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";
import {
  type FoundSymbol,
  findOccurrences,
  leafAt,
  type Occurrence,
  rangeOf,
  symbolAt,
} from "../references/index.js";
import type { VennServices } from "../services/lsp.types.js";
import { declaresDeco } from "./declares-deco.js";

/**
 * F2: rename a name wherever it means this one.
 *
 * Reads the same occurrences "find all references" reports, so the two cannot
 * disagree. A rename that silently misses a use is worse than no rename at all.
 */
export class VennRenameProvider implements RenameProvider {
  private readonly documents: LangiumDocuments;

  constructor(services: VennServices) {
    this.documents = services.shared.workspace.LangiumDocuments;
  }

  rename(document: LangiumDocument, params: RenameParams): WorkspaceEdit | undefined {
    const symbol = this.wanted(document, params);
    if (!symbol) return undefined;
    const changes: Record<string, TextEdit[]> = {};
    for (const found of findOccurrences({ symbol, document, documents: this.documents })) {
      const edits = rewrites(found.occurrences, params.newName);
      if (edits.length > 0) changes[found.uri] = edits;
    }
    return Object.keys(changes).length > 0 ? { changes } : undefined;
  }

  prepareRename(document: LangiumDocument, params: PrepareRenameParams): Range | undefined {
    return this.wanted(document, params) ? leafAt(document, params.position)?.range : undefined;
  }

  /**
   * The symbol under the cursor, when it is one this can rewrite.
   *
   * A built-in decorator has no source to rewrite, and changing one use of it
   * would break the program while looking like a rename.
   */
  private wanted(
    document: LangiumDocument,
    params: { position: PrepareRenameParams["position"] },
  ): FoundSymbol | undefined {
    const symbol = symbolAt(document, params.position);
    if (!symbol) return undefined;
    if (symbol.kind === "deco" && !declaresDeco(this.documents, symbol.name)) return undefined;
    return symbol;
  }
}

function rewrites(occurrences: readonly Occurrence[], newName: string): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const each of occurrences) {
    const range = rangeOf(each);
    if (range) edits.push({ range, newText: newName });
  }
  return edits;
}

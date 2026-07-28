import type { Document } from "@venn-lang/core";
import type { LangiumDocument } from "langium";
import type { DocumentHighlightProvider } from "langium/lsp";
import {
  type DocumentHighlight,
  DocumentHighlightKind,
  type DocumentHighlightParams,
} from "vscode-languageserver";
import { rangeOf } from "./occurrence-range.js";
import { occurrencesIn } from "./occurrences.js";
import type { Occurrence } from "./symbol.types.js";
import { symbolAt } from "./symbol-at.js";

/**
 * The other places the name under the cursor appears, marked in this file.
 *
 * Only this file, whatever the symbol's reach: highlighting is about the page
 * being read. Where the name is introduced is drawn apart from where it is
 * used, which is the quickest way to see that a value is written once and read
 * four times, or written twice, which is usually the bug being looked for.
 */
export class VennDocumentHighlightProvider implements DocumentHighlightProvider {
  getDocumentHighlight(
    document: LangiumDocument,
    params: DocumentHighlightParams,
  ): DocumentHighlight[] {
    const symbol = symbolAt(document, params.position);
    const root = document.parseResult?.value as Document | undefined;
    if (!symbol || !root) return [];
    return marked(occurrencesIn({ root, symbol }));
  }
}

function marked(occurrences: readonly Occurrence[]): DocumentHighlight[] {
  const found: DocumentHighlight[] = [];
  for (const each of occurrences) {
    const range = rangeOf(each);
    if (range) found.push({ range, kind: kindOf(each) });
  }
  return found;
}

function kindOf(occurrence: Occurrence): DocumentHighlightKind {
  return occurrence.declaration ? DocumentHighlightKind.Write : DocumentHighlightKind.Read;
}

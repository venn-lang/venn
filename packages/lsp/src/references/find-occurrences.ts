import type { Document } from "@venn/core";
import type { LangiumDocument, LangiumDocuments } from "langium";
import type { Location, Range } from "vscode-languageserver";
import { rangesOf } from "./occurrence-range.js";
import { occurrencesIn } from "./occurrences.js";
import { crossesFiles, type FoundSymbol, type Occurrence } from "./symbol.types.js";

/** One document's share of the answer. */
export interface FoundIn {
  uri: string;
  occurrences: readonly Occurrence[];
}

/**
 * Every place a symbol appears, in the file that asked and in the workspace
 * when the symbol reaches that far.
 *
 * A file-scoped binding is never searched for elsewhere. That is not an
 * optimisation: a `const` named `user` next door is a different `user`, and
 * offering it as a reference sends the reader somewhere unrelated.
 */
export function findOccurrences(args: {
  symbol: FoundSymbol;
  document: LangiumDocument;
  documents: LangiumDocuments;
}): FoundIn[] {
  const here = inDocument(args.document, args.symbol);
  if (!crossesFiles(args.symbol.kind)) return here ? [here] : [];
  const found: FoundIn[] = [];
  for (const document of args.documents.all) {
    const one = inDocument(document, args.symbol);
    if (one) found.push(one);
  }
  return found;
}

function inDocument(document: LangiumDocument, symbol: FoundSymbol): FoundIn | undefined {
  const root = document.parseResult?.value as Document | undefined;
  if (!root) return undefined;
  const occurrences = occurrencesIn({ root, symbol });
  return occurrences.length > 0 ? { uri: document.uri.toString(), occurrences } : undefined;
}

/** The same answer as locations, which is the shape the editor asks for. */
export function locationsOf(found: readonly FoundIn[]): Location[] {
  return found.flatMap((one) =>
    rangesOf(one.occurrences).map((range: Range) => ({ uri: one.uri, range })),
  );
}

import { DocumentState, type LangiumDocument, type URI } from "langium";
import type { LangiumSharedServices } from "langium/lsp";
import type { TypeService } from "./type-service.js";

/**
 * Keep the workspace's types warm.
 *
 * Langium already indexes every `.vn` in the opened folder, and re-indexes a
 * file when it changes. Hooking the same cycle means the project is fully typed
 * by the time you touch anything, and a keystroke re-types only the file you
 * edited, never the rest.
 */
export function warmTypes(shared: LangiumSharedServices, types: TypeService): void {
  const builder = shared.workspace.DocumentBuilder;
  builder.onBuildPhase(DocumentState.IndexedContent, (documents: LangiumDocument[]) => {
    for (const document of documents) warm(document, types);
  });
  builder.onUpdate((_changed: URI[], deleted: URI[]) => {
    for (const uri of deleted) types.forget(uri.toString());
  });
}

/** Inference must never take the server down: a bad file loses its types, nothing more. */
function warm(document: LangiumDocument, types: TypeService): void {
  try {
    types.of(document);
  } catch {
    types.forget(document.uri.toString());
  }
}

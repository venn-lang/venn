// @venn-lang/lsp: the Venn language server. Diagnostics, semantic highlighting,
// hover, go-to-definition, completion and the document outline.

export type { ActionEntry, MatcherEntry, SymbolCatalog } from "./catalog/index.js";
export { buildCatalog } from "./catalog/index.js";
export type { CompletionContext } from "./completion/index.js";
export { contextAt, modulePaths, VennCompletionProvider } from "./completion/index.js";
export type { DecoInfo, DecoScope } from "./deco/index.js";
export { builtinDecos, decoNamed, decosInScope } from "./deco/index.js";
export { VennDefinitionProvider } from "./definition/index.js";
export type { DocBlock, DocParam } from "./docs/index.js";
export { parseDoc, readDoc, renderDoc } from "./docs/index.js";
export type { FragmentLocation } from "./document/index.js";
export {
  exportedNames,
  findBinding,
  findFragment,
  importedNames,
  resolveFragment,
} from "./document/index.js";
export { VennFormatter } from "./formatting/index.js";
export { VennHoverProvider } from "./hover/index.js";
export {
  findOccurrences,
  occurrencesIn,
  symbolAt,
  VennDocumentHighlightProvider,
  VennReferencesProvider,
} from "./references/index.js";
export { VennRenameProvider } from "./rename/index.js";
export { VennSemanticTokenProvider } from "./semantic/index.js";
export { startVennServer } from "./server/index.js";
export type { VennAddedServices, VennServices } from "./services/index.js";
export { createVennLspServices } from "./services/index.js";
export { VennSignatureHelpProvider } from "./signature/index.js";
export { VennDocumentSymbolProvider } from "./symbols/index.js";
export { registerVennChecks } from "./validation/index.js";
export { createImportResolver, type ImportResolver } from "./workspace/index.js";

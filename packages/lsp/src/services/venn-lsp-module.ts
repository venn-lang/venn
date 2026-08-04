import { VennGeneratedModule, VennGeneratedSharedModule, VennLexer } from "@venn-lang/core";
import { allPlugins } from "@venn-lang/stdlib";
import { inject, type Module } from "langium";
import {
  createDefaultModule,
  createDefaultSharedModule,
  type DefaultSharedModuleContext,
  type LangiumSharedServices,
  type PartialLangiumServices,
} from "langium/lsp";
import { buildCatalog } from "../catalog/index.js";
import { VennCodeActionProvider } from "../code-actions/index.js";
import { VennCompletionProvider } from "../completion/index.js";
import { VennDefinitionProvider } from "../definition/index.js";
import { VennFormatter } from "../formatting/index.js";
import { VennHoverProvider } from "../hover/index.js";
import { VennDocumentHighlightProvider, VennReferencesProvider } from "../references/index.js";
import { VennRenameProvider } from "../rename/index.js";
import { VennSemanticTokenProvider } from "../semantic/index.js";
import { VennSignatureHelpProvider } from "../signature/index.js";
import { VennDocumentSymbolProvider } from "../symbols/index.js";
import { createTypeService, warmTypes } from "../types/index.js";
import { registerVennChecks, VennDocumentValidator } from "../validation/index.js";
import { createImportResolver } from "../workspace/index.js";
import type { VennAddedServices, VennServices } from "./lsp.types.js";

const VennModule: Module<VennServices, PartialLangiumServices & VennAddedServices> = {
  catalog: () => buildCatalog(allPlugins),
  imports: () => createImportResolver(),
  types: (services) => createTypeService(services),
  parser: { Lexer: (services) => new VennLexer(services) },
  validation: { DocumentValidator: (services) => new VennDocumentValidator(services) },
  lsp: {
    SemanticTokenProvider: (services) => new VennSemanticTokenProvider(services),
    HoverProvider: (services) => new VennHoverProvider(services),
    DefinitionProvider: (services) => new VennDefinitionProvider(services),
    CompletionProvider: (services) => new VennCompletionProvider(services),
    DocumentSymbolProvider: () => new VennDocumentSymbolProvider(),
    RenameProvider: (services) => new VennRenameProvider(services),
    ReferencesProvider: (services) => new VennReferencesProvider(services),
    DocumentHighlightProvider: () => new VennDocumentHighlightProvider(),
    CodeActionProvider: (services) => new VennCodeActionProvider(services),
    SignatureHelp: (services) => new VennSignatureHelpProvider(services),
    Formatter: (services) => new VennFormatter(services),
  },
};

/**
 * Build the Venn language services on top of Langium's LSP stack. Registering
 * the validator and warming the type cache happen here, so a caller only has to
 * supply a connection and start the server.
 *
 * @param context Langium's shared module context: a connection and a file system.
 * @returns The shared Langium services, and the Venn services built on them.
 */
export function createVennLspServices(context: DefaultSharedModuleContext): {
  shared: LangiumSharedServices;
  Venn: VennServices;
} {
  const shared = inject(createDefaultSharedModule(context), VennGeneratedSharedModule);
  const Venn = inject(createDefaultModule({ shared }), VennGeneratedModule, VennModule);
  shared.ServiceRegistry.register(Venn);
  registerVennChecks(Venn);
  warmTypes(shared, Venn.types);
  return { shared, Venn };
}

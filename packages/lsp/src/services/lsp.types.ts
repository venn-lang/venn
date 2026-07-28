import type { LangiumServices } from "langium/lsp";
import type { SymbolCatalog } from "../catalog/index.js";
import type { TypeService } from "../types/index.js";
import type { ImportResolver } from "../workspace/index.js";

/** The extra services Venn adds on top of Langium's LSP stack. */
export interface VennAddedServices {
  catalog: SymbolCatalog;
  imports: ImportResolver;
  types: TypeService;
}

/** The full language services for Venn. */
export type VennServices = LangiumServices & VennAddedServices;

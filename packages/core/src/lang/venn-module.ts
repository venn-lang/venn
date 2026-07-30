import {
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
  type LangiumCoreServices,
  type LanguageMetaData,
  type Module,
} from "langium";
import {
  VennGeneratedModule,
  VennGeneratedSharedModule,
  VennLanguageMetaData,
} from "../generated/module.js";
import { VennLexer } from "./venn-lexer.js";
import { VennValueConverter } from "./venn-value-converter.js";

// The newline-aware lexer, and the converter that unquotes the string forms
// Langium does not know about.
const VennLexerModule: Module<
  LangiumCoreServices,
  { parser: { Lexer: VennLexer; ValueConverter: VennValueConverter } }
> = {
  parser: {
    Lexer: (services) => new VennLexer(services),
    ValueConverter: () => new VennValueConverter(),
  },
};

function modeModule(
  mode: LanguageMetaData["mode"],
): Module<LangiumCoreServices, { LanguageMetaData: LanguageMetaData }> {
  return { LanguageMetaData: () => ({ ...VennLanguageMetaData, mode }) };
}

/**
 * Build the Langium core services on `EmptyFileSystem`, so no `node:*` is
 * touched and this runs in both the CLI (Node) and the LSP (Web Worker).
 *
 * `production` skips Chevrotain's grammar validation, which dominates the cost
 * of a first parse and only ever checks generated code against itself. That
 * check belongs in a test, `venn-module.test.ts`, which is why this takes a
 * mode at all.
 *
 * @param mode Langium language mode; `development` re-enables the validation.
 */
export function createVennServices(
  mode: LanguageMetaData["mode"] = "production",
): LangiumCoreServices {
  const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), VennGeneratedSharedModule);
  const venn = inject(
    createDefaultCoreModule({ shared }),
    VennGeneratedModule,
    VennLexerModule,
    modeModule(mode),
  );
  shared.ServiceRegistry.register(venn);
  return venn;
}

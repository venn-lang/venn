import { formatOptionsFrom, formatText } from "@venn/core";
import type { LangiumDocument } from "langium";
import type { Formatter } from "langium/lsp";
import type {
  DocumentFormattingParams,
  DocumentOnTypeFormattingOptions,
  DocumentOnTypeFormattingParams,
  DocumentRangeFormattingParams,
  FormattingOptions,
  Range,
  TextEdit,
} from "vscode-languageserver";
import type { VennServices } from "../services/lsp.types.js";
import type { ImportResolver } from "../workspace/index.js";

/**
 * Formatting runs through `@venn/core`, so the editor and `venn fmt` produce
 * byte-identical output. Project settings come from `[format]` in `venn.toml`;
 * the editor's own indent settings fill in what the project left unset.
 */
export class VennFormatter implements Formatter {
  private readonly imports: ImportResolver;

  constructor(services: VennServices) {
    this.imports = services.imports;
  }

  /** Re-indent the line as soon as a block is closed. */
  get formatOnTypeOptions(): DocumentOnTypeFormattingOptions {
    return { firstTriggerCharacter: "}", moreTriggerCharacter: ["\n"] };
  }

  formatDocument(document: LangiumDocument, params: DocumentFormattingParams): TextEdit[] {
    return this.rewrite(document, params.options);
  }

  formatDocumentRange(
    document: LangiumDocument,
    params: DocumentRangeFormattingParams,
  ): TextEdit[] {
    return this.rewrite(document, params.options);
  }

  formatDocumentOnType(
    document: LangiumDocument,
    params: DocumentOnTypeFormattingParams,
  ): TextEdit[] {
    return this.rewrite(document, params.options);
  }

  // One whole-document edit: the header may move lines, so per-line edits cannot
  // express the result.
  private rewrite(document: LangiumDocument, editor: FormattingOptions): TextEdit[] {
    const source = document.textDocument.getText();
    const project = formatOptionsFrom(this.imports.formatSettings(document.uri));
    const formatted = formatText(source, { ...fromEditor(editor), ...project });
    return formatted === source ? [] : [{ range: whole(document), newText: formatted }];
  }
}

function fromEditor(options: FormattingOptions): { indentWidth: number; useTabs: boolean } {
  return { indentWidth: options.tabSize, useTabs: !options.insertSpaces };
}

function whole(document: LangiumDocument): Range {
  const text = document.textDocument;
  return { start: { line: 0, character: 0 }, end: text.positionAt(text.getText().length) };
}

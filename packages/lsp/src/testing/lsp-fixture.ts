import { readFileSync } from "node:fs";
import { EmptyFileSystem, type LangiumDocument, URI } from "langium";
import type { LangiumSharedServices } from "langium/lsp";
import { NodeFileSystem } from "langium/node";
import type { Position, TextEdit } from "vscode-languageserver";
import { createVennLspServices } from "../services/index.js";
import type { VennServices } from "../services/lsp.types.js";

/** A built language service plus one parsed, validated in-memory document. */
export interface Fixture {
  services: VennServices;
  document: LangiumDocument;
  uri: string;
}

// Three slashes: the path must carry the `.vn` extension for the service registry.
const FOLDER = "memory:///";
const NAME = "test.vn";

/**
 * Build the services and a validated document: the seam every LSP test drives.
 *
 * `modules` are files placed beside it, keyed by file name, so an `import …
 * from "./lib.vn"` resolves without a disk anywhere in sight.
 */
export async function fixture(
  source: string,
  modules: Record<string, string> = {},
): Promise<Fixture> {
  const { shared, Venn } = createVennLspServices(EmptyFileSystem);
  const beside = Object.entries(modules).map(([name, text]) => added(shared, name, text));
  const document = added(shared, NAME, source);
  await shared.workspace.DocumentBuilder.build([...beside, document], { validation: true });
  // The document's own string form: vscode-uri normalises, so never re-derive it.
  return { services: Venn, document, uri: document.uri.toString() };
}

function added(shared: LangiumSharedServices, name: string, source: string): LangiumDocument {
  const uri = URI.parse(`${FOLDER}${name}`);
  const document = shared.workspace.LangiumDocumentFactory.fromString(source, uri);
  shared.workspace.LangiumDocuments.addDocument(document);
  return document;
}

/**
 * Same, but for a real file on disk, on the node filesystem, so `venn.toml`,
 * `#alias` paths and imported documents all resolve the way they do in an editor.
 */
export async function fixtureFromFile(path: string): Promise<Fixture> {
  const { shared, Venn } = createVennLspServices(NodeFileSystem);
  const uri = URI.file(path);
  const source = readFileSync(path, "utf8");
  const document = shared.workspace.LangiumDocumentFactory.fromString(source, uri);
  shared.workspace.LangiumDocuments.addDocument(document);
  await shared.workspace.DocumentBuilder.build([document], { validation: false });
  return { services: Venn, document, uri: document.uri.toString() };
}

/** Apply edits to the document's text, last-to-first so earlier offsets stay valid. */
export function applyEdits(document: LangiumDocument, edits: readonly TextEdit[]): string {
  const text = document.textDocument;
  const offset = (edit: TextEdit): number => text.offsetAt(edit.range.start);
  const sorted = [...edits].sort((a, b) => offset(b) - offset(a));
  let out = text.getText();
  for (const edit of sorted) {
    out = out.slice(0, offset(edit)) + edit.newText + out.slice(text.offsetAt(edit.range.end));
  }
  return out;
}

/**
 * The position where `needle` starts, which is inside its first token, even for
 * one-character names like `x`.
 */
export function positionOf(document: LangiumDocument, needle: string): Position {
  return document.textDocument.positionAt(document.textDocument.getText().indexOf(needle));
}

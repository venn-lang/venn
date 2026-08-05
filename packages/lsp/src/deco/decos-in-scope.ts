import { type Document, isValueImport, type ValueImport } from "@venn-lang/core";
import type { LangiumDocument, LangiumDocuments } from "langium";
import { documentRoot } from "../document/index.js";
import type { ImportResolver } from "../workspace/index.js";
import { builtinDecos } from "./builtin-decos.js";
import { localDecos } from "./declared-deco.js";
import type { DecoInfo } from "./deco.types.js";

/** What a file needs consulted before it can say what `@name` means. */
export interface DecoScope {
  document: LangiumDocument;
  documents: LangiumDocuments;
  imports: ImportResolver;
}

/**
 * Every decorator a `@name` written in this file could mean: the ones the
 * language ships with, the `pub deco`s it imported, and the `deco`s it declares
 * itself.
 *
 * Later wins, on the same rule the runtime already follows for plugins: the
 * built-ins are a stdlib, not a reserved word list, so a file that declares its
 * own `deco retry` means its own.
 */
export async function decosInScope(scope: DecoScope): Promise<DecoInfo[]> {
  const root = documentRoot(scope.document);
  if (!root) return builtinDecos();
  const imported = await importedDecos(root, scope);
  return dedupe([...builtinDecos(), ...imported, ...localDecos(root, scope.document)]);
}

/** The decorator a `@name` resolves to, or nothing when no decorator carries it. */
export async function decoNamed(name: string, scope: DecoScope): Promise<DecoInfo | undefined> {
  return (await decosInScope(scope)).find((info) => info.name === name);
}

async function importedDecos(root: Document, scope: DecoScope): Promise<DecoInfo[]> {
  const found: DecoInfo[] = [];
  for (const decl of root.imports) {
    if (isValueImport(decl)) found.push(...(await fromModule(decl, scope)));
  }
  return found;
}

// Only what the other file marked `pub`, and only the names this one asked for.
async function fromModule(decl: ValueImport, scope: DecoScope): Promise<DecoInfo[]> {
  const uri = scope.imports.resolve(decl.path, scope.document.uri);
  const document = await scope.documents.getOrCreateDocument(uri).catch(() => undefined);
  const root = document && documentRoot(document);
  if (!document || !root) return [];
  return localDecos(root, document).filter(
    (info) => info.decl?.export && decl.names.some((one) => one.name === info.name),
  );
}

function dedupe(all: readonly DecoInfo[]): DecoInfo[] {
  const byName = new Map<string, DecoInfo>();
  for (const info of all) byName.set(info.name, info);
  return [...byName.values()];
}

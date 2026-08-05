import { type Document, type FragmentDecl, isValueImport } from "@venn-lang/core";
import type { LangiumDocument, LangiumDocuments, URI } from "langium";
import type { ImportResolver } from "../workspace/index.js";
import { findFragment } from "./find-binding.js";
import { type HandedOn, handsOn } from "./hands-on.js";

/** Where a fragment lives. `decl` is absent when the file could not be read. */
export interface FragmentLocation {
  uri: URI;
  decl?: FragmentDecl;
  document?: LangiumDocument;
}

export interface ResolveFragmentArgs {
  name: string;
  document: LangiumDocument;
  documents: LangiumDocuments;
  imports: ImportResolver;
}

/** Find a fragment: declared in this file, or followed through the `import` naming it. */
export async function resolveFragment(
  args: ResolveFragmentArgs,
): Promise<FragmentLocation | undefined> {
  const root = args.document.parseResult?.value as Document | undefined;
  if (!root) return undefined;
  const local = findFragment(root, args.name);
  if (local) return { uri: args.document.uri, decl: local, document: args.document };
  const decl = root.imports.find(
    (node) =>
      isValueImport(node) && node.names.some((one) => (one.alias ?? one.name) === args.name),
  );
  return isValueImport(decl) ? fromImport(decl.path, args) : undefined;
}

/**
 * Follow the import, and whatever it hands the name on to.
 *
 * One hop reaches a folder's face and no further, and a face declares nothing:
 * the location came back with a `uri` and no `decl`, so the card read
 * `fragment …` over `mod.vn` rather than the signature over the file that has
 * it. The last file reached is the one reported either way, so a name nothing
 * declares still names where the search ended.
 *
 * The name travels with the walk, because `pub import { order as pedido }` is
 * `pedido` here and `order` in the file behind it.
 */
async function fromImport(path: string, args: ResolveFragmentArgs): Promise<FragmentLocation> {
  let at = { uri: args.imports.resolve(path, args.document.uri), name: args.name };
  const seen = new Set<string>();
  for (;;) {
    const found = await readAt(at, args);
    if (!found.onward || seen.has(at.uri.toString())) return found.location;
    seen.add(at.uri.toString());
    at = { uri: args.imports.resolve(found.onward.decl.path, at.uri), name: found.onward.name };
  }
}

/** Where the walk stands, and where it goes next if this file only hands on. */
interface Step {
  location: FragmentLocation;
  onward?: HandedOn;
}

/** One file of the walk: what it declares, or what it hands the name on to. */
async function readAt(at: { uri: URI; name: string }, args: ResolveFragmentArgs): Promise<Step> {
  const document = await args.documents.getOrCreateDocument(at.uri).catch(() => undefined);
  const root = document?.parseResult?.value as Document | undefined;
  const decl = root ? findFragment(root, at.name) : undefined;
  const onward = root && !decl ? handsOn(root, at.name) : undefined;
  return { location: { uri: at.uri, decl, document }, onward };
}

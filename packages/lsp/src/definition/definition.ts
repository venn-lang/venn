import {
  type AstNode,
  type Document,
  isAnnotation,
  isNamedType,
  isRef,
  isRunStmt,
  isValueImport,
} from "@venn-lang/core";
import { CstUtils, type LangiumDocument, type LangiumDocuments, type URI } from "langium";
import type { DefinitionProvider } from "langium/lsp";
import type { DefinitionParams, LocationLink } from "vscode-languageserver";
import { decoNamed } from "../deco/index.js";
import { findBinding, findType, interpolationAt, resolveFragment } from "../document/index.js";
import type { VennServices } from "../services/lsp.types.js";
import type { ImportResolver } from "../workspace/index.js";

const ORIGIN = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

/** Ctrl+Click: `run` fragments (local or imported), bindings, and imported files. */
export class VennDefinitionProvider implements DefinitionProvider {
  private readonly documents: LangiumDocuments;
  private readonly imports: ImportResolver;

  constructor(services: VennServices) {
    this.documents = services.shared.workspace.LangiumDocuments;
    this.imports = services.imports;
  }

  async getDefinition(
    document: LangiumDocument,
    params: DefinitionParams,
  ): Promise<LocationLink[] | undefined> {
    const root = document.parseResult?.value?.$cstNode;
    if (!root) return undefined;
    const offset = document.textDocument.offsetAt(params.position);
    const inString = this.interpolated({ document, offset });
    if (inString) return [inString];
    const node = CstUtils.findLeafNodeAtOffset(root, offset)?.astNode;
    const link = node && (await this.resolve(node, document));
    return link ? [link] : undefined;
  }

  /** `"${base}/users"`: the name inside the placeholder is a real reference. */
  private interpolated(args: {
    document: LangiumDocument;
    offset: number;
  }): LocationLink | undefined {
    const hit = interpolationAt(args);
    if (!hit?.isHead) return undefined;
    return localLink(findBinding(hit.host, hit.name), args.document);
  }

  private async resolve(
    node: AstNode,
    document: LangiumDocument,
  ): Promise<LocationLink | undefined> {
    if (isRunStmt(node)) return this.fragment(node.target, document);
    if (isAnnotation(node)) return this.decorator(node.name, document);
    if (isRef(node)) return localLink(findBinding(node, node.name), document);
    if (isValueImport(node)) return fileLink(this.imports.resolve(node.path, document.uri));
    // A type is its own namespace, so this asks the type table rather than the
    // one a `Ref` reads: `type Sale` and `let Sale` can both be written here.
    if (isNamedType(node)) return this.type(node.name, document);
    return undefined;
  }

  /** `list<Sale>` lands on the `type Sale` this file declares. */
  private type(name: string, document: LangiumDocument): LocationLink | undefined {
    const root = document.parseResult?.value as Document | undefined;
    return root ? localLink(findType(root, name), document) : undefined;
  }

  // `@memoize` lands on the `deco memoize` that defines it, here or across an
  // import. A built-in has no source to land on, so nothing happens.
  private async decorator(
    name: string,
    document: LangiumDocument,
  ): Promise<LocationLink | undefined> {
    const scope = { document, documents: this.documents, imports: this.imports };
    const found = await decoNamed(name, scope);
    return found?.document ? localLink(found.decl, found.document) : undefined;
  }

  // Land on the declaration when the file can be read; otherwise open the file.
  private async fragment(
    name: string,
    document: LangiumDocument,
  ): Promise<LocationLink | undefined> {
    const location = await resolveFragment({
      name,
      document,
      documents: this.documents,
      imports: this.imports,
    });
    if (!location) return undefined;
    const precise = location.document && localLink(location.decl, location.document);
    return precise ?? fileLink(location.uri);
  }
}

function localLink(node: AstNode | undefined, document: LangiumDocument): LocationLink | undefined {
  const range = node?.$cstNode?.range;
  if (!range) return undefined;
  return { targetUri: document.uri.toString(), targetRange: range, targetSelectionRange: range };
}

function fileLink(uri: URI): LocationLink {
  return { targetUri: uri.toString(), targetRange: ORIGIN, targetSelectionRange: ORIGIN };
}

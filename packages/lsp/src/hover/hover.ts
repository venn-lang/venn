import {
  type ActionCall,
  type AstNode,
  type Document,
  isActionCall,
  isAnnotation,
  isDecoDecl,
  isFnDecl,
  isFragmentDecl,
  isMatcherClause,
  isMember,
  isNamedType,
  isRunStmt,
  isUseDecl,
  isValueImport,
  type ValueImport,
} from "@venn-lang/core";
import {
  type CstNode,
  CstUtils,
  GrammarUtils,
  type LangiumDocument,
  type LangiumDocuments,
} from "langium";
import type { HoverProvider } from "langium/lsp";
import { type Hover, type HoverParams, MarkupKind } from "vscode-languageserver";
import type { SymbolCatalog } from "../catalog/index.js";
import { declaredDeco, decoHover, decoNamed, documentedHover } from "../deco/index.js";
import {
  findBinding,
  hostAt,
  interpolationAt,
  pathOf,
  resolveFragment,
  resolveImported,
} from "../document/index.js";
import { waitingFns } from "../effects/index.js";
import { envHover, envVars } from "../env/index.js";
import type { VennServices } from "../services/lsp.types.js";
import type { TypeService } from "../types/index.js";
import type { ImportResolver } from "../workspace/index.js";
import { keywordHover } from "./keywords.js";
import { actionHover, matcherHover } from "./render-action.js";
import { declarationHover, fragmentHover, useHover } from "./render-decl.js";
import { importedHover, importPathHover } from "./render-imported.js";
import { memberHover } from "./render-symbol.js";
import { typeNameHover } from "./render-type-name.js";
import { resolveSymbol } from "./resolve-symbol.js";
import { inferredType } from "./type-hover.js";

/**
 * Rich markdown hover: actions, matchers, fragments, bindings and keywords.
 *
 * Which token the cursor sits on decides the answer, so every branch checks the
 * CST property it belongs to rather than the enclosing node alone.
 */
export class VennHoverProvider implements HoverProvider {
  private readonly catalog: SymbolCatalog;
  private readonly documents: LangiumDocuments;
  private readonly imports: ImportResolver;
  private readonly types: TypeService;

  constructor(services: VennServices) {
    this.catalog = services.catalog;
    this.documents = services.shared.workspace.LangiumDocuments;
    this.imports = services.imports;
    this.types = services.types;
  }

  async getHoverContent(
    document: LangiumDocument,
    params: HoverParams,
  ): Promise<Hover | undefined> {
    const offset = document.textDocument.offsetAt(params.position);
    const leaf = leafAt(document, offset);
    const value =
      this.inString(document, offset) ??
      (leaf && (await this.describe(leaf, document))) ??
      (leaf ? inferredType(leaf, this.types) : undefined);
    return value ? { contents: { kind: MarkupKind.Markdown, value } } : undefined;
  }

  /** Inside `"${…}"` the name is code, so it hovers like code, not like text. */
  private inString(document: LangiumDocument, offset: number): string | undefined {
    const hit = interpolationAt({ document, offset });
    if (!hit) return undefined;
    if (hit.path.startsWith("env.")) {
      // `env` the namespace explains itself; `env.NAME` describes the variable.
      return hit.isHead ? keywordHover("env") : this.envVar(hit.name, document);
    }
    // Resolve against the parsed expression when there is one: a name bound
    // inside the placeholder, such as a lambda parameter, lives only there.
    const host = hostAt({ document, offset, types: this.types.of(document) }) ?? hit.host;
    return (
      this.member(host, hit.name, document) ??
      this.resolve({ path: hit.path, segment: hit.segment, host, document })
    );
  }

  /**
   * A member read off the node rather than off the text.
   *
   * The dotted-path resolver can only name a chain of identifiers, so it has
   * nothing to say about `(1234.567).round` or `f(x).len`. The receiver's
   * inferred type is right there on the tree, so read it from there instead.
   */
  private member(node: AstNode, name: string, document: LangiumDocument): string | undefined {
    if (!isMember(node) || node.member !== name) return undefined;
    const receiver = this.types.of(document).types.get(node.receiver);
    return receiver ? memberHover({ receiver, member: name }) : undefined;
  }

  /** The one resolver every place uses, so a name reads the same anywhere. */
  private resolve(args: {
    path: string;
    segment: number;
    host: AstNode;
    document: LangiumDocument;
  }): string | undefined {
    return resolveSymbol({ ...args, catalog: this.catalog, types: this.types });
  }

  /** Which of this file's functions wait for something, for the signature to say so. */
  private waits(document: LangiumDocument): ReadonlySet<string> {
    const root = document.parseResult?.value as Document | undefined;
    return root ? waitingFns(root, this.catalog) : new Set();
  }

  /** `env.NAME` is not a variable anyone declared here; `venn.toml` declares it. */
  private envVar(name: string, document: LangiumDocument): string | undefined {
    const found = envVars(this.imports.env(document.uri), this.imports.envDocs(document.uri)).find(
      (variable) => variable.name === name,
    );
    return found && envHover(found);
  }

  private async describe(leaf: CstNode, document: LangiumDocument): Promise<string | undefined> {
    return (await this.symbol(leaf, document)) ?? keywordHover(leaf.text);
  }

  // Which token the cursor sits on decides this: `run login()` is a keyword on
  // `run` and a fragment on `login`.
  private async symbol(leaf: CstNode, document: LangiumDocument): Promise<string | undefined> {
    const node = leaf.astNode;
    if (isAnnotation(node)) return this.decorator(node.name, document);
    const env = envPath(node);
    if (env) return this.envVar(env, document);
    if (isValueImport(node)) return this.imported(node, leaf, document);
    const symbol = this.pathHover(node, document);
    if (symbol) return symbol;
    const member = this.member(node, leaf.text, document);
    if (member) return member;
    if (isActionCall(node) && on(leaf, node, "target"))
      return this.callTarget(node, leaf, document);
    if (isNamedType(node)) return typeNameHover(node.name, this.catalog);
    if (isMatcherClause(node) && on(leaf, node, "name"))
      return matcherHover(node.name, this.catalog);
    if (isUseDecl(node) && on(leaf, node, "pkg")) return useHover(node, this.catalog);
    return this.declared(leaf, node, document);
  }

  /**
   * A name in an `import` list, or the specifier it comes from.
   *
   * The list is the one place a name is neither declared nor used, so no other
   * branch reaches it. It is also where a reader is deciding whether they want
   * the thing at all, which is where a hover is worth the most.
   */
  private async imported(
    node: ValueImport,
    leaf: CstNode,
    document: LangiumDocument,
  ): Promise<string | undefined> {
    const name = importedName(node, leaf.text);
    const location = await resolveImported({
      name: name ?? "",
      decl: node,
      document,
      documents: this.documents,
      imports: this.imports,
    });
    if (name) return importedHover({ location, name, types: this.types });
    // The specifier, and `helpers` in `import * as helpers`, which names the
    // whole file rather than anything inside it, so the file is the answer.
    if (!on(leaf, node, "path") && leaf.text !== node.wildcard) return undefined;
    return importPathHover({ location, path: node.path });
  }

  /**
   * The verb of a call written as a statement.
   *
   * Usually a plugin's, as in `http.get`. But `target.wrap(…)` is a method on a
   * value, and the parser reads it as a call whose target is text, so the
   * member chain a hover normally walks does not exist. Resolving from that
   * text puts it back, which is why hovering `target` inside a `deco` answers.
   */
  private callTarget(
    node: ActionCall,
    leaf: CstNode,
    document: LangiumDocument,
  ): string | undefined {
    const head = node.target.split(".")[0];
    if (head && findBinding(node, head)) {
      return this.resolve({
        path: node.target,
        segment: dotsBefore(node, leaf),
        host: node,
        document,
      });
    }
    return actionHover(node.target, this.catalog);
  }

  /**
   * A dotted path written plainly: `fmt.json`, `xs.map`, `range`. The segment
   * under the cursor decides what is described: the namespace, or its verb.
   */
  private pathHover(node: AstNode, document: LangiumDocument): string | undefined {
    const path = pathOf(outermost(node));
    if (!path) return undefined;
    return this.resolve({ path, segment: segmentAt(node), host: node, document });
  }

  private async declared(
    leaf: CstNode,
    node: AstNode,
    document: LangiumDocument,
  ): Promise<string | undefined> {
    if (isRunStmt(node) && on(leaf, node, "target")) return this.fragment(node.target, document);
    if (isFnDecl(node) && on(leaf, node, "name"))
      return declarationHover({ document, node, types: this.types, waiting: this.waits(document) });
    if (isFragmentDecl(node) && on(leaf, node, "name")) return this.fragment(node.name, document);
    if (isDecoDecl(node) && on(leaf, node, "name")) {
      return decoHover(declaredDeco({ decl: node, document }));
    }
    if (!on(leaf, node, "name")) return undefined;
    return declarationHover({ document, node, types: this.types, waiting: this.waits(document) });
  }

  /**
   * `@name`: whatever defines it. A `deco` this file declares or imported, or
   * a built-in; either way the same text a hover on the `deco` itself gives.
   */
  private async decorator(name: string, document: LangiumDocument): Promise<string | undefined> {
    const scope = { document, documents: this.documents, imports: this.imports };
    const found = await decoNamed(name, scope);
    return found ? decoHover(found) : documentedHover(name);
  }

  private async fragment(name: string, document: LangiumDocument): Promise<string | undefined> {
    const location = await resolveFragment({
      name,
      document,
      documents: this.documents,
      imports: this.imports,
    });
    return location && fragmentHover(location);
  }
}

/**
 * Which name of an import the cursor is on, if any.
 *
 * `import { a, b }` names two things and `import x from` names one, but both
 * are one node carrying plain strings, so the word under the cursor is the
 * only thing that says which was meant.
 */
function importedName(node: ValueImport, text: string): string | undefined {
  if (node.names.includes(text)) return text;
  return node.default === text ? text : undefined;
}

/** True when the cursor's token lies inside the CST range of that property. */
function on(leaf: CstNode, node: AstNode, property: string): boolean {
  const cst = GrammarUtils.findNodeForProperty(node.$cstNode, property);
  return Boolean(cst && leaf.offset >= cst.offset && leaf.offset < cst.offset + cst.length);
}

function leafAt(document: LangiumDocument, offset: number): CstNode | undefined {
  const root = document.parseResult?.value?.$cstNode;
  return root ? CstUtils.findLeafNodeAtOffset(root, offset) : undefined;
}

/** The variable name in `env.NAME`, when that is what the cursor is on. */
function envPath(node: AstNode): string | undefined {
  const path = pathOf(node);
  return path?.startsWith("env.") && !path.slice(4).includes(".") ? path.slice(4) : undefined;
}

/** Climb to the end of a member chain: from `fmt` in `fmt.json`, to `fmt.json`. */
function outermost(node: AstNode): AstNode {
  let current = node;
  while (isMember(current.$container) && current.$container.receiver === current) {
    current = current.$container;
  }
  return current;
}

/**
 * The same count for a call whose target is text rather than a chain: the dots
 * standing between the start of `target.wrap` and the token under the cursor.
 */
function dotsBefore(node: ActionCall, leaf: CstNode): number {
  const start = node.$cstNode?.offset ?? 0;
  const upTo = node.target.slice(0, Math.max(0, leaf.offset - start));
  return upTo.split(".").length - 1;
}

/**
 * How many dots separate the chain's head from the token under the cursor. The
 * cursor's own node is the innermost one that reaches it, so its depth in the
 * chain is the answer: `a` is 0, `a.b` is 1, `a.b.c` is 2.
 */
function segmentAt(node: AstNode): number {
  let depth = 0;
  let current: AstNode = node;
  while (isMember(current)) {
    depth += 1;
    current = current.receiver;
  }
  return depth;
}

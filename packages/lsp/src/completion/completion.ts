import { type AstNode, type Document, isUseDecl } from "@venn/core";
import type { LangiumDocument, LangiumDocuments } from "langium";
import type { CompletionProvider } from "langium/lsp";
import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Position,
  Range,
} from "vscode-languageserver";
import type { SymbolCatalog } from "../catalog/index.js";
import { decosInScope } from "../deco/index.js";
import {
  exportedNames,
  hostAt,
  importedFragments,
  importedModules,
  namesInScope,
  type ScopedName,
} from "../document/index.js";
import { envVars } from "../env/index.js";
import type { VennServices } from "../services/lsp.types.js";
import {
  activeArg,
  type CallShape,
  callShape,
  enclosingBareCall,
  enclosingCall,
  enclosingMatcher,
  enclosingParenCall,
  matcherShape,
  type ShownArg,
  shapeAt,
} from "../signature/index.js";
import type { TypeService } from "../types/index.js";
import type { ImportResolver } from "../workspace/index.js";
import { argumentItems, boundItems } from "./argument-items.js";
import type { CompletionContext } from "./completion.types.js";
import { contextAt } from "./context.js";
import {
  actionItems,
  annotationItems,
  envItems,
  exportItems,
  fragmentItems,
  matcherItems,
  openingItems,
  optionItems,
  packageItems,
  pathItems,
  typeItems,
} from "./items.js";
import { memberItems, membersOfNode } from "./member-items.js";
import { modulePaths } from "./module-paths.js";
import { optionsMapItems } from "./options-map-items.js";
import { typeNameItems } from "./type-name-items.js";

/**
 * Context-aware completion, driven by the text before the cursor.
 *
 * `contextAt` classifies the cursor, and each context has exactly one source of
 * items: a namespace's verbs, an options map's keys, the names in scope.
 */
export class VennCompletionProvider implements CompletionProvider {
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

  async getCompletion(
    document: LangiumDocument,
    params: CompletionParams,
  ): Promise<CompletionList> {
    const line = lineAt(document, params.position);
    const text = document.textDocument.getText();
    const offset = document.textDocument.offsetAt(params.position);
    const context = contextAt({
      prefix: line.slice(0, params.position.character),
      line,
      before: text.slice(0, offset),
    });
    const range = rangeOf(context, params.position);
    return { isIncomplete: false, items: await this.itemsFor(context, range, document, offset) };
  }

  /**
   * What follows a dot. A name the file bound wins over a plugin namespace, the
   * same rule the evaluator and the highlighter follow, so a variable named
   * `auth` completes as its own value even when `@venn/auth` is loaded.
   */
  private afterDot(
    receiver: string,
    range: Range,
    document: LangiumDocument,
    offset: number,
  ): CompletionItem[] {
    const types = this.types.of(document);
    const host = hostAt({ document, offset, types, prefer: "before" });
    const members = host
      ? memberItems({ receiver, host, document, types: this.types, range })
      : undefined;
    if (members?.length) return members;
    if (receiver === "env") return this.env(document, range);
    // A namespace answers with what it does and with what it deals in.
    return [
      ...actionItems(receiver, this.catalog, range),
      ...typeItems(receiver, this.catalog, range),
    ];
  }

  /**
   * What follows a dot no name can precede: `(1234.567).`, `f(x).`, `xs[0].`.
   * The receiver has no text to look up, so its inferred type answers.
   */
  private afterExpression(
    range: Range,
    document: LangiumDocument,
    offset: number,
  ): CompletionItem[] {
    const types = this.types.of(document);
    const host = hostAt({ document, offset, types, prefer: "before" });
    return host ? membersOfNode({ host, at: offset, document, types: this.types, range }) : [];
  }

  private env(document: LangiumDocument, range: Range): CompletionItem[] {
    const uri = document.uri;
    return envItems(envVars(this.imports.env(uri), this.imports.envDocs(uri)), range);
  }

  private async itemsFor(
    context: CompletionContext,
    range: Range,
    document: LangiumDocument,
    offset: number,
  ): Promise<CompletionItem[]> {
    if (context.kind === "package") return packageItems(this.catalog, range);
    if (context.kind === "modulePath") return this.paths(context.partial, range, document);
    if (context.kind === "importName") return this.exports(context.path, range, document);
    if (context.kind === "action") return this.afterDot(context.receiver, range, document, offset);
    if (context.kind === "member") return this.afterExpression(range, document, offset);
    if (context.kind === "annotation") return this.decorators(document, range);
    if (context.kind === "fragment") return this.fragments(range, document);
    if (context.kind === "matcher") return matcherItems(this.catalog, range);
    if (context.kind === "optionKey") {
      return optionItems({ target: context.target, catalog: this.catalog, range });
    }
    if (context.kind === "typeName") return this.typeNames(range, document);
    if (context.kind === "argument") return this.argument(context, range, document, offset);
    return this.fallback(range, document, offset);
  }

  /**
   * Every name in scope, with an imported one drawn as what it really is.
   *
   * `namesInScope` reads this file's tree, so it can say only that a name came
   * from an import. Its kind lives in the file it came from, which is in reach
   * here, so an imported fragment is drawn as a fragment rather than as an
   * anonymous binding.
   */
  private scopeNames(host: AstNode, at: number, document: LangiumDocument): ScopedName[] {
    const found = namesInScope(host, at);
    if (!found.some((one) => one.origin === "import")) return found;
    const root = rootOf(document);
    const known = root ? this.publishedTo(root, document) : new Map<string, string>();
    return found.map((one) =>
      one.origin === "import" ? { ...one, origin: known.get(one.name) ?? one.origin } : one,
    );
  }

  /** What each name this file imported was declared as, in the file it came from. */
  private publishedTo(root: Document, document: LangiumDocument): Map<string, string> {
    const graph = importedModules({
      root,
      uri: document.uri,
      documents: this.documents,
      imports: this.imports,
    });
    const known = new Map<string, string>();
    for (const module of graph.modules.values()) {
      for (const each of exportedNames(module)) known.set(each.name, each.origin);
    }
    return known;
  }

  /**
   * `run ▮`: the fragments this file declared, and the ones it imported.
   *
   * `run` can only invoke a fragment, so an imported name is offered only once
   * the file it came from confirms it is one.
   */
  private fragments(range: Range, document: LangiumDocument): CompletionItem[] {
    const root = rootOf(document);
    if (!root) return [];
    const graph = importedModules({
      root,
      uri: document.uri,
      documents: this.documents,
      imports: this.imports,
    });
    const imported = importedFragments({ document: root, uri: document.uri.toString(), graph });
    return fragmentItems({ document: root, imported, range });
  }

  /** `id: ▮`: the language's own types, this file's, and its imports'. */
  private typeNames(range: Range, document: LangiumDocument): CompletionItem[] {
    const root = rootOf(document);
    return typeNameItems({
      root,
      catalog: this.catalog,
      imported: root ? namespacesUsed(root, this.catalog) : [],
      range,
    });
  }

  /**
   * The last two shapes a cursor can be in before it is simply a new statement:
   * inside a call's brackets, or after a matcher word.
   */
  private fallback(range: Range, document: LangiumDocument, offset: number): CompletionItem[] {
    return (
      this.inBrackets(range, document, offset) ??
      this.afterBareCall(range, document, offset) ??
      this.afterMatcher(range, document, offset) ??
      this.opening(range, document, offset)
    );
  }

  /**
   * A fresh statement: the names already bound, then the words that open one.
   *
   * Calling a function is itself a statement, so bound names belong here. They
   * come first because the language's own vocabulary is always available.
   */
  private opening(range: Range, document: LangiumDocument, offset: number): CompletionItem[] {
    const host = hostAt({ document, offset, types: this.types.of(document), prefer: "before" });
    const bound = host ? boundItems(this.scopeNames(host, offset, document), range) : [];
    return [...bound, ...openingItems(this.catalog, range)];
  }

  /**
   * `const r = http.get "u" ▮`: a bracket-less call bound to a name.
   *
   * The `argument` context reads the head of the line, which here is `const`
   * rather than the verb. Same words deserve the same help, so it is caught
   * separately.
   */
  private afterBareCall(
    range: Range,
    document: LangiumDocument,
    offset: number,
  ): CompletionItem[] | undefined {
    const call = enclosingBareCall(document, offset);
    const shape = call && callShape(call.target, this.catalog);
    if (!call || !shape) return undefined;
    return this.dueAt({
      active: activeArg(call, offset),
      shape,
      host: call.node,
      range,
      document,
      at: offset,
    });
  }

  /** What may go in this position: a value, or the options map that ends the call. */
  private dueAt(args: {
    active: number;
    shape: CallShape;
    host: AstNode;
    range: Range;
    document: LangiumDocument;
    at: number;
  }): CompletionItem[] {
    const { active, shape } = args;
    if (active >= shape.args.length && shape.options.length > 0) {
      return optionsMapItems(shape.options, args.range);
    }
    return this.valuesFor({ ...args, expects: shape.args[active] });
  }

  /** `expect res contains ▮`: the value the check is waiting for. */
  private afterMatcher(
    range: Range,
    document: LangiumDocument,
    offset: number,
  ): CompletionItem[] | undefined {
    const clause = enclosingMatcher(document, offset);
    if (!clause) return undefined;
    const shape = matcherShape(clause.name, this.catalog);
    const expects = shape?.args[activeArg(clause, offset)];
    return this.valuesFor({ host: clause, expects, range, document, at: offset });
  }

  /**
   * `saudacao(▮)`, `fmt.json(x, ▮)`: inside a bracketed call.
   *
   * Reached last, before offering a fresh statement. Everything more specific
   * (a dot, an options key, a bare argument) has already had its turn, so what
   * is left inside brackets is a value.
   */
  private inBrackets(
    range: Range,
    document: LangiumDocument,
    offset: number,
  ): CompletionItem[] | undefined {
    const found = enclosingParenCall(document, offset);
    if (!found?.host) return undefined;
    const shape = shapeAt({ ...found, document, catalog: this.catalog, types: this.types });
    if (!shape)
      return this.valuesFor({ host: found.host, expects: undefined, range, document, at: offset });
    return this.dueAt({
      active: found.active,
      shape,
      host: found.host,
      range,
      document,
      at: offset,
    });
  }

  /**
   * `http.on ▮`: what the program already holds, before what the stdlib offers.
   * A name the text took for a verb but the language does not know is not an
   * argument position at all, so that falls back to a fresh statement.
   */
  private argument(
    context: { target: string; from: number },
    range: Range,
    document: LangiumDocument,
    offset: number,
  ): CompletionItem[] {
    const shape = callShape(context.target, this.catalog);
    const call = enclosingCall(document, offset);
    // The text took the head of the line for a verb and the language disagrees:
    // `const t = saudacao(▮)` reads that way and is a bracketed call.
    if (!shape || !call) {
      return this.fallback(range, document, offset);
    }
    const expects = shape.args[activeArg(call, offset)];
    return this.valuesFor({ host: call, expects, range, document, at: offset });
  }

  /** What the program holds that could go here, the fitting ones first. */
  private valuesFor(args: {
    host: AstNode;
    expects: ShownArg | undefined;
    range: Range;
    document: LangiumDocument;
    at: number;
  }): CompletionItem[] {
    return argumentItems({
      names: this.scopeNames(args.host, args.at, args.document),
      types: this.types.of(args.document).types,
      expects: args.expects,
      catalog: this.catalog,
      range: args.range,
    });
  }

  // The built-ins, the `deco`s this file declares, and the `pub deco`s it imported.
  private async decorators(document: LangiumDocument, range: Range): Promise<CompletionItem[]> {
    const scope = { document, documents: this.documents, imports: this.imports };
    return annotationItems(await decosInScope(scope), range);
  }

  private paths(partial: string, range: Range, document: LangiumDocument): CompletionItem[] {
    const paths = modulePaths({ partial, base: document.uri, imports: this.imports });
    return pathItems(paths, range);
  }

  // Only what the imported module marks `pub` may be named inside `import { … }`.
  private async exports(
    path: string | undefined,
    range: Range,
    document: LangiumDocument,
  ): Promise<CompletionItem[]> {
    if (!path) return [];
    const uri = this.imports.resolve(path, document.uri);
    const target = await this.documents.getOrCreateDocument(uri).catch(() => undefined);
    const root = target?.parseResult?.value as Document | undefined;
    return root ? exportItems(exportedNames(root), range) : [];
  }
}

function rangeOf(context: CompletionContext, position: Position): Range {
  return { start: { line: position.line, character: context.from }, end: position };
}

function rootOf(document: LangiumDocument): Document | undefined {
  return document.parseResult?.value as Document | undefined;
}

function lineAt(document: LangiumDocument, position: Position): string {
  const text = document.textDocument.getText();
  const start = document.textDocument.offsetAt({ line: position.line, character: 0 });
  const end = text.indexOf("\n", start);
  return text.slice(start, end < 0 ? text.length : end);
}

/** The namespaces this file brought in; a type it cannot name is not offered. */
function namespacesUsed(root: Document, catalog: SymbolCatalog): string[] {
  const names: string[] = [];
  for (const decl of root.imports) {
    if (!isUseDecl(decl)) continue;
    const namespace = decl.alias ?? catalog.namespaceOfPackage(decl.pkg);
    if (namespace) names.push(namespace);
  }
  return names;
}

import {
  type AstNode,
  isActionCall,
  isLetStmt,
  isMatcherClause,
  isRunStmt,
  isStringLit,
  isUseDecl,
  type UseDecl,
} from "@venn-lang/core";
import { CstUtils, type LangiumDocument } from "langium";
import type { CodeActionProvider } from "langium/lsp";
import {
  type CodeAction,
  CodeActionKind,
  type CodeActionParams,
  type Diagnostic,
  type TextEdit,
} from "vscode-languageserver";
import type { SymbolCatalog } from "../catalog/index.js";
import { pathOf } from "../document/index.js";
import type { VennServices } from "../services/lsp.types.js";
import type { ImportResolver } from "../workspace/index.js";
import { alreadyImports, headerEdit } from "./anchor.js";
import { modulesExporting } from "./exporting-modules.js";
import { importedName } from "./imported-name.js";

interface FixArgs {
  title: string;
  edit: TextEdit;
  document: LangiumDocument;
  diagnostic: Diagnostic;
  preferred: boolean;
}

/**
 * Lightbulb fixes for the two "you never brought this in" diagnostics. When more
 * than one source provides the name, every source is offered and the first is
 * marked preferred, so the editor shows it first and applies it on Quick Fix.
 */
export class VennCodeActionProvider implements CodeActionProvider {
  private readonly catalog: SymbolCatalog;
  private readonly imports: ImportResolver;

  constructor(services: VennServices) {
    this.catalog = services.catalog;
    this.imports = services.imports;
  }

  getCodeActions(document: LangiumDocument, params: CodeActionParams): CodeAction[] {
    return params.context.diagnostics.flatMap((diagnostic) => this.fixes(diagnostic, document));
  }

  private fixes(diagnostic: Diagnostic, document: LangiumDocument): CodeAction[] {
    if (diagnostic.code === "VN2007") return this.addUse(diagnostic, document);
    if (diagnostic.code === "VN2005") return this.addImport(diagnostic, document);
    if (diagnostic.code === "VN5001") return this.removed(diagnostic, document);
    return [];
  }

  /** The import that brings the name in, written at the top with the others. */
  private addUse(diagnostic: Diagnostic, document: LangiumDocument): CodeAction[] {
    const node = nodeAt(document, diagnostic);
    const name = importedName(node);
    if (!name) return [];
    return this.sources(node).map((pkg, index) =>
      fix({
        title: `Add import { ${name} } from "${pkg}"`,
        edit: headerEdit(document, `import { ${name} } from "${pkg}"`, "use"),
        document,
        diagnostic,
        preferred: index === 0,
      }),
    );
  }

  /** Every package that would bring this name in, as action, matcher or call. */
  private sources(node: AstNode | undefined): readonly string[] {
    if (!node) return [];
    if (isMatcherClause(node)) {
      const found = this.catalog.matcher(node.name);
      return found ? [found.package] : [];
    }
    // The read may hide inside `${…}`, where the node is the string, not a path.
    if (isStringLit(node)) return this.interpolatedSources(node);
    // A bare path counts too: `env.BASE_URL` is a read, and it still needs a `use`.
    const path = isActionCall(node) ? node.target : pathOf(isLetStmt(node) ? node.value : node);
    const namespace = path?.split(".")[0];
    return namespace ? this.catalog.packagesFor(namespace) : [];
  }

  /** The package for the first namespace read in `"…${env.X}…"` we recognise. */
  private interpolatedSources(node: { value?: string }): readonly string[] {
    for (const match of (node.value ?? "").matchAll(/\$\{\s*([A-Za-z_]\w*)\./g)) {
      const packages = this.catalog.packagesFor(match[1] ?? "");
      if (packages.length > 0) return packages;
    }
    return [];
  }

  /** A keyword that is gone, and the line that says what it used to. */
  private removed(diagnostic: Diagnostic, document: LangiumDocument): CodeAction[] {
    const node = nodeAt(document, diagnostic);
    if (isUseDecl(node)) return this.writeImport(diagnostic, document, node);
    return this.useLet(diagnostic, document);
  }

  /** `use "venn/http"` is `import { http } from "venn/http"`, alias and all. */
  private writeImport(
    diagnostic: Diagnostic,
    document: LangiumDocument,
    node: UseDecl,
  ): CodeAction[] {
    const namespace = this.catalog.namespaceOfPackage(node.pkg);
    if (!namespace) return [];
    const named = node.alias ? `${namespace} as ${node.alias}` : namespace;
    const edit = { range: diagnostic.range, newText: `import { ${named} } from "${node.pkg}"` };
    return [
      fix({
        title: `Replace with import { ${named} }`,
        edit,
        document,
        diagnostic,
        preferred: true,
      }),
    ];
  }

  /** `capture` is spelled `let`, so the fix is exactly one word wide. */
  private useLet(diagnostic: Diagnostic, document: LangiumDocument): CodeAction[] {
    const { start } = diagnostic.range;
    const end = { line: start.line, character: start.character + "capture".length };
    const edit = { range: { start, end }, newText: "let" };
    return [
      fix({ title: "Replace `capture` with `let`", edit, document, diagnostic, preferred: true }),
    ];
  }

  private addImport(diagnostic: Diagnostic, document: LangiumDocument): CodeAction[] {
    const node = nodeAt(document, diagnostic);
    if (!node || !isRunStmt(node)) return [];
    const name = node.target;
    const modules = modulesExporting({ name, base: document.uri, imports: this.imports });
    return modules
      .filter((module) => !alreadyImports(document, module.specifier))
      .map((module, index) =>
        fix({
          title: `Import ${name} from "${module.specifier}"`,
          edit: headerEdit(document, `import { ${name} } from "${module.specifier}"`, "import"),
          document,
          diagnostic,
          preferred: index === 0,
        }),
      );
  }
}

function fix(args: FixArgs): CodeAction {
  return {
    title: args.title,
    kind: CodeActionKind.QuickFix,
    diagnostics: [args.diagnostic],
    isPreferred: args.preferred,
    edit: { changes: { [args.document.uri.toString()]: [args.edit] } },
  };
}

function nodeAt(document: LangiumDocument, diagnostic: Diagnostic): AstNode | undefined {
  const root = document.parseResult?.value?.$cstNode;
  if (!root) return undefined;
  const offset = document.textDocument.offsetAt(diagnostic.range.start);
  return CstUtils.findLeafNodeAtOffset(root, offset)?.astNode;
}

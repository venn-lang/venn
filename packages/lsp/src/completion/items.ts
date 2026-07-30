import { type Document, isFragmentDecl, showType, specToType } from "@venn-lang/core";
import { type ActionDefinition, paramSpecs } from "@venn-lang/sdk";
import { showSpec } from "@venn-lang/types";
import { type CompletionItem, CompletionItemKind, type Range } from "vscode-languageserver";
import type { SymbolCatalog } from "../catalog/index.js";
import { type DecoInfo, decoratesLabel } from "../deco/index.js";
import type { ExportedName } from "../document/index.js";
import type { EnvVar } from "../env/index.js";
import { ICON, iconForOrigin } from "./icons.js";

const KEYWORDS = [
  "step",
  "group",
  "if",
  "else",
  "match",
  "forEach",
  "repeat",
  "loop",
  "parallel",
  "race",
  "try",
  "catch",
  "finally",
  "expect",
  "run",
  "let",
  "const",
  "return",
  "break",
  "continue",
  "defer",
  "setup",
  "teardown",
  "beforeEach",
  "afterEach",
];
// Callable without a `use`: verbs that act, plus the values with no receiver.
const PRELUDE = [
  "print",
  "log",
  "wait",
  "skip",
  "fail",
  "exit",
  "range",
  "str",
  "typeOf",
  "pretty",
];

/**
 * Every item carries an explicit `textEdit` over `range`. VS Code's default word
 * rules stop at `@` and `/`, so without it accepting `@venn-lang/http` inside
 * `"@venn-lang/"` would paste the prefix twice.
 */
export function item(args: {
  label: string;
  kind: CompletionItemKind;
  range: Range;
  detail?: string;
  documentation?: string;
  /** What to write, when it differs from the label: `body` inserts `body: `. */
  insert?: string;
}): CompletionItem {
  return {
    label: args.label,
    kind: args.kind,
    detail: args.detail,
    documentation: args.documentation,
    filterText: args.label,
    textEdit: { range: args.range, newText: args.insert ?? args.label },
  };
}

/**
 * The keys of an action's options map, read from its params schema. That is the
 * schema the runtime validates against, so the editor cannot drift from it.
 */
export function optionItems(args: {
  target: string;
  catalog: SymbolCatalog;
  range: Range;
}): CompletionItem[] {
  const dot = args.target.indexOf(".");
  if (dot < 0) return [];
  const entry = args.catalog.action(args.target.slice(0, dot), args.target.slice(dot + 1));
  return paramSpecs(entry?.action.params).map((spec) =>
    item({
      label: spec.name,
      kind: ICON.key,
      range: args.range,
      detail: spec.required ? `${spec.type} (required)` : spec.type,
      documentation: spec.doc,
      insert: `${spec.name}: `,
    }),
  );
}

/** `env.`: the variables `venn.toml` declares, secrets shown without values. */
export function envItems(vars: readonly EnvVar[], range: Range): CompletionItem[] {
  return vars.map((variable) =>
    item({
      label: variable.name,
      kind: ICON.env,
      range,
      detail: variable.secret ? "secret" : variable.values[0]?.value,
      documentation:
        variable.doc ??
        `Declared in venn.toml for ${variable.values.map((v) => v.environment).join(", ")}.`,
    }),
  );
}

export function packageItems(catalog: SymbolCatalog, range: Range): CompletionItem[] {
  return catalog.packages().map((label) => {
    const namespace = catalog.namespaceOfPackage(label);
    return item({ label, kind: ICON.namespace, range, detail: namespace });
  });
}

/**
 * The types a namespace publishes: `http.Request`, `http.Server`.
 *
 * They stand beside the verbs because that is where they are written. A
 * namespace answering only with verbs leaves the author guessing what those
 * verbs deal in.
 */
export function typeItems(
  namespace: string,
  catalog: SymbolCatalog,
  range: Range,
): CompletionItem[] {
  return catalog.typesIn(namespace).map((entry) =>
    item({
      label: entry.name,
      kind: ICON.type,
      range,
      detail: showType(specToType(entry.spec, () => undefined)),
      documentation: `Type published by ${entry.package}.`,
    }),
  );
}

export function actionItems(
  namespace: string,
  catalog: SymbolCatalog,
  range: Range,
): CompletionItem[] {
  return catalog.actionsIn(namespace).map((entry) =>
    item({
      label: entry.name,
      kind: ICON.verb,
      range,
      detail: returnOf(entry.action) ?? entry.package,
      documentation: entry.action.doc,
    }),
  );
}

/** What the verb answers with, taken from its declared type, never from prose. */
function returnOf(action: ActionDefinition): string | undefined {
  const result = action.signature?.result;
  if (!result || (result.kind === "prim" && result.name === "void")) return undefined;
  return `-> ${showSpec(result)}`;
}

export function matcherItems(catalog: SymbolCatalog, range: Range): CompletionItem[] {
  return catalog
    .matchers()
    .map((entry) => item({ label: entry.name, kind: ICON.matcher, range, detail: entry.package }));
}

/**
 * After `@`: every decorator in scope, each saying what it decorates.
 *
 * What it decorates is the detail, not an afterthought: applying one to the
 * wrong kind is the mistake this list exists to prevent.
 */
export function annotationItems(decos: readonly DecoInfo[], range: Range): CompletionItem[] {
  return decos.map((deco) =>
    item({
      label: deco.name,
      kind: ICON.decorator,
      range,
      detail: decoratesLabel(deco.decorates),
      documentation: deco.doc,
    }),
  );
}

export function fragmentItems(args: {
  document: Document | undefined;
  /** The imported names that really are fragments, from the files they came from. */
  imported: ReadonlySet<string>;
  range: Range;
}): CompletionItem[] {
  if (!args.document) return [];
  const local = args.document.decls.filter(isFragmentDecl).map((decl) => decl.name);
  return simple([...local, ...args.imported], ICON.fragment, args.range);
}

export function pathItems(paths: readonly string[], range: Range): CompletionItem[] {
  return simple(paths, CompletionItemKind.File, range);
}

export function exportItems(names: readonly ExportedName[], range: Range): CompletionItem[] {
  return names.map((each) =>
    item({
      label: each.name,
      kind: iconForOrigin(each.origin),
      range,
      detail: `pub ${each.origin}`,
    }),
  );
}

/** At the start of a statement: namespaces, prelude verbs and structural keywords. */
export function openingItems(catalog: SymbolCatalog, range: Range): CompletionItem[] {
  return [
    ...simple(catalog.namespaces(), CompletionItemKind.Module, range),
    ...simple(PRELUDE, CompletionItemKind.Function, range),
    ...simple(KEYWORDS, CompletionItemKind.Keyword, range),
  ];
}

function simple(
  labels: readonly string[],
  kind: CompletionItemKind,
  range: Range,
): CompletionItem[] {
  return labels.map((label) => item({ label, kind, range }));
}

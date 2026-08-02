import {
  type AstNode,
  type FnDecl,
  type FragmentDecl,
  isCaptureStmt,
  isDecoDecl,
  isFnDecl,
  isFnExpr,
  isForEachStmt,
  isFragmentDecl,
  isLetStmt,
  isParam,
  isRepeatStmt,
  type ParamList,
} from "@venn-lang/core";
import { type LangiumDocument, UriUtils } from "langium";
import type { SymbolCatalog } from "../catalog/index.js";
import { readDoc, renderDoc } from "../docs/index.js";
import { type FragmentLocation, findBinding } from "../document/index.js";
import { code, fence, rule, sections } from "../markdown/index.js";
import type { TypeService } from "../types/index.js";
import { typeLabel } from "./type-hover.js";

/** Hover for a fragment: its signature, its documentation, and where it lives. */
export function fragmentHover(location: FragmentLocation): string {
  const file = code(UriUtils.basename(location.uri));
  if (!location.decl || !location.document) {
    return rule([fence("fragment …"), `Imported from ${file}.`]);
  }
  const { decl, document } = location;
  const params = (decl.params?.params ?? []).map((param) => param.name).join(", ");
  const signature = `${decl.export ? "pub " : ""}fragment ${decl.name}(${params})`;
  return rule([fence(signature), renderDoc(readDoc(document, decl)), `Declared in ${file}`]);
}

/** Hover for a variable reference, resolved to whatever binds it. */
export function bindingHover(args: {
  document: LangiumDocument;
  node: AstNode;
  name: string;
  types: TypeService;
  waiting?: ReadonlySet<string>;
}): string | undefined {
  const binding = findBinding(args.node, args.name);
  return binding && renderBinding({ ...args, binding });
}

/** Hover on the declaration itself (`let plan = …`, `resource db = …`). */
export function declarationHover(args: {
  document: LangiumDocument;
  node: AstNode;
  types: TypeService;
  /** Names of the functions in this file that wait for something. */
  waiting?: ReadonlySet<string>;
}): string | undefined {
  const name = declaredName(args.node);
  if (name === undefined) return undefined;
  return renderBinding({ ...args, binding: args.node, name });
}

/** Hover for the specifier of an import: what that package contributes. */
export function packageHover(spec: string, catalog: SymbolCatalog): string | undefined {
  const namespace = catalog.namespaceOfPackage(spec);
  if (!namespace) return rule([fence(`"${spec}"`), "Package is not loaded."]);
  const count = catalog.actionsIn(namespace).length;
  const verbs = `Contributes ${count} action${count === 1 ? "" : "s"} under ${code(namespace)}.`;
  return rule([fence(`import { ${namespace} } from "${spec}"`), verbs]);
}

function renderBinding(args: {
  document: LangiumDocument;
  binding: AstNode;
  name: string;
  types: TypeService;
  waiting?: ReadonlySet<string>;
}): string {
  const { document, binding, name } = args;
  const waits = Boolean(args.waiting?.has(name)) && isFnDecl(binding);
  const body = sections([renderDoc(readDoc(document, binding)), describe(binding), waited(waits)]);
  return rule([fence(signatureOf(binding, name, args.types, waits)), body || undefined]);
}

/**
 * Said plainly, because nothing in the source says it. The runtime waits for
 * this on its own, with no keyword written, so the editor is the only place a
 * reader can find out.
 */
function waited(waits: boolean): string | undefined {
  if (!waits) return undefined;
  return "**Waits**, it reaches for a plugin verb, so it hands back a value that is still arriving. Anything that binds it with `let` gets the value.";
}

function declaredName(node: AstNode): string | undefined {
  if (isLetStmt(node) || isCaptureStmt(node)) return node.name;
  if (isFnDecl(node)) return node.name;
  return isParam(node) ? node.name : undefined;
}

/** The signature line, carrying the inferred type when the checker knows one. */
function signatureOf(binding: AstNode, name: string, types: TypeService, waits = false): string {
  // `~>` rather than `->`: the arrow says the answer takes a moment.
  const type = waiting(typeLabel(binding, types), waits);
  const typed = type ? `: ${type}` : "";
  if (isFnDecl(binding))
    return `${binding.export ? "pub " : ""}fn ${written(binding, name)}${typed}`;
  if (isLetStmt(binding)) return `${binding.kind} ${name}${typed}`;
  if (isCaptureStmt(binding)) return `capture ${name}`;
  if (isFragmentDecl(binding)) return `fragment ${written(binding, name)}`;
  if (isParam(binding)) return `${name}${typed || ": parameter"}`;
  return name;
}

/**
 * The name with the parameter list the source actually wrote.
 *
 * The type alone says `fn(a, b) -> a`, which tells the reader how many and not
 * which. The names are right there in the declaration, and they are the half a
 * caller has to get right.
 */
function written(binding: FnDecl | FragmentDecl, name: string): string {
  const names = (binding.params?.params ?? []).map((param) => param.name);
  return `${name}(${names.join(", ")})`;
}

function waiting(type: string | undefined, waits: boolean): string | undefined {
  return type && waits ? type.replace(" -> ", " ~> ") : type;
}

/** Where a parameter came from: a function's own list, a decorator's, a fragment's. */
function paramOwner(param: AstNode): string {
  const owner = param.$container?.$container;
  if (isFnDecl(owner)) return "Parameter of this `fn`.";
  if (isFnExpr(owner)) return "Parameter of this function, typed by where it is called.";
  if (isDecoDecl(owner)) return decoParam(param);
  return "Fragment parameter.";
}

/** A `deco`'s first parameter is the thing decorated; the rest are its arguments. */
function decoParam(param: AstNode): string {
  const list = param.$container as ParamList | undefined;
  if (list?.params[0] !== param) return "Argument of this decorator, filled by `@name(…)`.";
  return "What this decorator decorates, its type is the kind it may be written on.";
}

function describe(binding: AstNode): string | undefined {
  if (isForEachStmt(binding)) return "Loop variable of `forEach`.";
  if (isRepeatStmt(binding)) return "Loop index of `repeat`.";
  if (isParam(binding)) return paramOwner(binding);
  return undefined;
}

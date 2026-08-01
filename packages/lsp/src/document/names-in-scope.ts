import {
  type AstNode,
  type BindsValue,
  type Block,
  boundNames,
  type Document,
  isBlock,
  isCaptureStmt,
  isDecoDecl,
  isDocument,
  isFnBody,
  isFnDecl,
  isFnExpr,
  isForEachStmt,
  isFragmentDecl,
  isLetStmt,
  isMatchArm,
  isPackageSpecifier,
  isRepeatStmt,
  isValueImport,
  loopBinding,
  type ParamList,
} from "@venn-lang/core";

/** A name the program has bound, and the node that bound it. */
export interface ScopedName {
  name: string;
  node: AstNode;
  /** How it came to be here: `const`, `parameter`, `fragment`, `resource`. */
  origin: string;
}

/**
 * Every name visible from `from`, innermost first.
 *
 * The mirror of `findBinding`, which answers about one name at a time. Asking
 * the other way round is what lets the editor offer what is actually there:
 * `http.on ` suggests the server two lines up, not every namespace loaded.
 */
export function namesInScope(from: AstNode, at?: number): ScopedName[] {
  const found: ScopedName[] = [];
  const seen = new Set<string>();
  let node: AstNode | undefined = from;
  while (node) {
    for (const each of bindingsIn(node)) {
      if (seen.has(each.name) || beingWritten(each, at)) continue;
      seen.add(each.name);
      found.push(each);
    }
    node = node.$container;
  }
  return found;
}

/**
 * Whether the cursor is inside what this binding is being given.
 *
 * `const t = saudacao(▮)` must not offer `t`: nothing holds it yet, and
 * accepting it would write a definition in terms of itself.
 */
function beingWritten(scoped: ScopedName, at: number | undefined): boolean {
  if (at === undefined) return false;
  const value = isLetStmt(scoped.node) && scoped.node.value;
  const cst = value ? value.$cstNode : undefined;
  return Boolean(cst && at >= cst.offset && at <= cst.end);
}

function bindingsIn(node: AstNode): ScopedName[] {
  if (isForEachStmt(node)) return sites(loopBinding(node), node, "each");
  if (isMatchArm(node))
    return node.patterns.flatMap((one) => sites({ pattern: one }, node, "match"));
  if (isRepeatStmt(node)) return node.index ? [{ name: node.index, node, origin: "index" }] : [];
  if (isFragmentDecl(node) || isFnDecl(node) || isFnExpr(node) || isDecoDecl(node))
    return params(node.params);
  if (isFnBody(node)) return node.locals.flatMap((local) => sites(local, local, "let"));
  if (isBlock(node)) return blockNames(node);
  if (isDocument(node)) return documentNames(node);
  return [];
}

function blockNames(block: Block): ScopedName[] {
  return block.stmts.flatMap(declaredNames);
}

function documentNames(document: Document): ScopedName[] {
  return [...document.decls.flatMap(declaredNames), ...importedInto(document)];
}

/** What one declaration puts in scope, which a pattern makes more than one of. */
function declaredNames(node: AstNode): ScopedName[] {
  if (isLetStmt(node)) return sites(node, node, kindOf(node));
  if (isCaptureStmt(node)) return [named(node, node.name, kindOf(node))];
  if (!declares(node)) return [];
  return [named(node, (node as unknown as { name: string }).name, kindOf(node))];
}

/**
 * The names this file pulled in from another.
 *
 * An imported name is bound as firmly as a local one: it can be called, passed
 * and held, so it belongs in scope like any other.
 */
function importedInto(document: Document): ScopedName[] {
  const found: ScopedName[] = [];
  for (const decl of document.imports) {
    // A package's namespace is offered as a namespace, further down the list:
    // it is a bag of verbs rather than a value an argument is likely to want.
    if (!isValueImport(decl) || isPackageSpecifier(decl.path)) continue;
    const names = decl.wildcard ? [decl.wildcard] : decl.names.map((one) => one.alias ?? one.name);
    for (const name of names) found.push(named(decl, name, "import"));
  }
  return found;
}

/**
 * A `fn` counts: it is a value the file bound, and passing one by name is how
 * `http.on(api, route)` is written.
 */
function declares(decl: AstNode): boolean {
  return isLetStmt(decl) || isFragmentDecl(decl) || isFnDecl(decl);
}

function kindOf(node: AstNode): string {
  if (isLetStmt(node)) return node.kind;
  if (isFragmentDecl(node)) return "fragment";
  return isFnDecl(node) ? "fn" : "let";
}

function params(list: ParamList | undefined): ScopedName[] {
  return (list?.params ?? []).flatMap((param) => sites(param, param, "parameter"));
}

/**
 * What one binding site puts in scope. A pattern is several names, and the
 * editor has to know each of them: they are what the body reads.
 */
function sites(site: BindsValue, node: AstNode, origin: string): ScopedName[] {
  return boundNames(site).map((name) => named(node, name, origin));
}

function named(node: AstNode, name: string, origin: string): ScopedName {
  return { name, node, origin };
}

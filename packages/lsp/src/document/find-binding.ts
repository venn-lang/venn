import {
  type AstNode,
  type Block,
  type Document,
  type FragmentDecl,
  isBlock,
  isCaptureStmt,
  isDatasetDecl,
  isDecoDecl,
  isDocument,
  isFnBody,
  isFnDecl,
  isFnExpr,
  isForEachStmt,
  isFragmentDecl,
  isLetStmt,
  isRepeatStmt,
  type ParamList,
} from "@venn-lang/core";

/** The node that binds `name`, searched from `from` outwards to the document. */
export function findBinding(from: AstNode, name: string): AstNode | undefined {
  let node: AstNode | undefined = from;
  while (node) {
    const found = bindingIn(node, name);
    if (found) return found;
    node = node.$container;
  }
  return undefined;
}

/** The fragment a document declares under `name`. */
export function findFragment(document: Document, name: string): FragmentDecl | undefined {
  return document.decls.find(
    (decl): decl is FragmentDecl => isFragmentDecl(decl) && decl.name === name,
  );
}

/**
 * The top-level declaration a document makes under `name`.
 *
 * The same lookup a name written in that file resolves to, reused from outside
 * it, which is what following an `import` does.
 */
export function findDeclaration(document: Document, name: string): AstNode | undefined {
  return documentBinding(document, name);
}

function bindingIn(node: AstNode, name: string): AstNode | undefined {
  if (isForEachStmt(node)) return node.item === name ? node : undefined;
  if (isRepeatStmt(node)) return node.index === name ? node : undefined;
  // A `deco` binds its parameters the way a `fn` does. The first one being the
  // target is a fact about its type, not about how it comes into scope.
  if (isFragmentDecl(node) || isFnDecl(node) || isFnExpr(node) || isDecoDecl(node))
    return paramNamed(node.params, name);
  if (isFnBody(node)) return node.locals.find((local) => local.name === name);
  if (isBlock(node)) return statementBinding(node, name);
  if (isDocument(node)) return documentBinding(node, name);
  return undefined;
}

function statementBinding(block: Block, name: string): AstNode | undefined {
  return block.stmts.find((stmt) => (isLetStmt(stmt) || isCaptureStmt(stmt)) && stmt.name === name);
}

function documentBinding(document: Document, name: string): AstNode | undefined {
  return document.decls.find((decl) => declares(decl, name));
}

/**
 * A `fn` is a value like any other: it can be passed, bound and called, so a
 * file that declares one has bound that name.
 */
function declares(decl: AstNode, name: string): boolean {
  if (isLetStmt(decl) || isDatasetDecl(decl)) return decl.name === name;
  if (isFnDecl(decl) || isDecoDecl(decl)) return decl.name === name;
  return isFragmentDecl(decl) && decl.name === name;
}

function paramNamed(params: ParamList | undefined, name: string): AstNode | undefined {
  return (params?.params ?? []).find((param) => param.name === name);
}

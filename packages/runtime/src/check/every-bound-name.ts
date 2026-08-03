import {
  type AstNode,
  boundNames,
  isDecoDecl,
  isFnDecl,
  isForEachStmt,
  isFragmentDecl,
  isLetStmt,
  isLoopState,
  isMatchArm,
  isNamespaceDecl,
  isParam,
  isRepeatStmt,
  isRunStmt,
  isTryExpr,
  isTryStmt,
  isValueImport,
  loopBinding,
  patternNames,
  walkAst,
} from "@venn-lang/core";

/**
 * Every name this document binds anywhere, flat.
 *
 * Flat on purpose. Whether a name is in scope *here* is a harder question than
 * whether it exists at all, and the harder one is not what a typo needs
 * answering. A check that reports a name used before its own declaration would
 * be right about scope and wrong about the file, and a diagnostic that is wrong
 * even sometimes is one people learn to ignore.
 *
 * So this over-collects, and the check that reads it only ever asks "does this
 * name exist nowhere at all".
 *
 * @param root The parsed file, or any subtree of one: an expression parsed out
 * of a `${…}` binds names of its own that the file it sits in never saw.
 * @returns Every name bound by a binding, a parameter, a loop, a declaration,
 * an import, a catch, a `run … as`, or a pattern in any of them.
 */
export function everyBoundName(root: AstNode): Set<string> {
  const names = new Set<string>();
  for (const node of [root, ...walkAst(root)]) for (const name of namesOf(node)) names.add(name);
  return names;
}

function namesOf(node: AstNode): readonly string[] {
  if (isLetStmt(node) || isParam(node)) return boundNames(node);
  if (isForEachStmt(node)) return boundNames(loopBinding(node));
  if (isFnDecl(node) || isFragmentDecl(node) || isDecoDecl(node)) return [node.name];
  if (isNamespaceDecl(node)) return [node.name];
  if (isLoopState(node)) return [node.name];
  if (isMatchArm(node)) return node.patterns.flatMap(patternNames);
  if (isValueImport(node)) return imported(node);
  return other(node);
}

/** The four that carry an optional name, each in its own field. */
function other(node: AstNode): readonly string[] {
  if (isRepeatStmt(node)) return node.index ? [node.index] : [];
  if (isRunStmt(node)) return node.bind ? [node.bind] : [];
  if (isTryStmt(node) || isTryExpr(node)) return node.error ? [node.error] : [];
  return [];
}

/** What an import puts in scope, under whichever name this file gave it. */
function imported(node: {
  names: readonly { name: string; alias?: string }[];
  wildcard?: string;
  default?: string;
}): string[] {
  if (node.wildcard) return [node.wildcard];
  if (node.default) return [node.default];
  return node.names.map((one) => one.alias ?? one.name);
}

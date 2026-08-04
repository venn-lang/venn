import { isFnDecl, isLetStmt, isNamespaceDecl, isTypeDecl } from "@venn-lang/core";

/**
 * What a `namespace` body can hold.
 *
 * A namespace is a way of grouping names, so it holds the four things that are
 * names: a function, a binding, a type, and another namespace. The grammar lets
 * it hold any declaration at all, and everything downstream walked the top level
 * only, so a `flow` moved inside one to group it stopped being a test and the
 * suite still reported green.
 *
 * @param held One declaration written inside a namespace body.
 * @returns Whether a namespace is a place this can be written.
 */
export function heldByANamespace(held: object): boolean {
  return isFnDecl(held) || isLetStmt(held) || isTypeDecl(held) || isNamespaceDecl(held);
}

/**
 * What to call the construct in a refusal, in the word the source used.
 *
 * A statement has no keyword of its own to quote, so it is described instead:
 * naming the node type would put the compiler's vocabulary in the user's error.
 */
const WORDS: Record<string, string> = {
  ActionCall: "a verb",
  AssignStmt: "an assignment",
  CaptureStmt: "a `capture`",
  ConfigDecl: "a `config`",
  DecoDecl: "a `deco`",
  ExpectStmt: "an `expect`",
  FlowDecl: "a `flow`",
  ForEachStmt: "a `forEach`",
  FragmentDecl: "a `fragment`",
  IfStmt: "an `if`",
  LifecycleDecl: "a lifecycle hook",
  LoopStmt: "a `loop`",
  MatchExpr: "a `match`",
  MatrixDecl: "a `matrix`",
  ParallelStmt: "a `parallel`",
  RaceStmt: "a `race`",
  RepeatStmt: "a `repeat`",
  RunStmt: "a `run`",
  TryStmt: "a `try`",
};

/**
 * How a refusal names one declaration.
 *
 * @param held The declaration a namespace body cannot hold.
 * @returns The word the source wrote it with, in the language's own vocabulary.
 */
export function wordFor(held: object): string {
  return WORDS[(held as { $type: string }).$type] ?? "this";
}

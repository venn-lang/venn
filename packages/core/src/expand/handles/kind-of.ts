import type { AstNode } from "langium";
import type { TargetKind } from "./handle.types.js";

/** Every kind a `deco` may name, in the order a diagnostic should list them. */
export const TARGET_KINDS: readonly TargetKind[] = [
  "Fn",
  "Flow",
  "Step",
  "Binding",
  "Type",
  "Node",
];

/**
 * The only place the two vocabularies meet.
 *
 * `Node` is absent on purpose: it is not one node type, it is the absence of a
 * restriction, so it maps to no `$type` and to every one.
 */
const BY_TYPE: Readonly<Record<string, TargetKind>> = {
  FnDecl: "Fn",
  FlowDecl: "Flow",
  StepDecl: "Step",
  LetStmt: "Binding",
  TypeDecl: "Type",
};

/** What kind of thing a node is, in the language's own words. */
export function kindOf(node: AstNode): TargetKind {
  return BY_TYPE[node.$type] ?? "Node";
}

/** Whether a written type name is one of the kinds. */
export function isTargetKind(name: string): name is TargetKind {
  return (TARGET_KINDS as readonly string[]).includes(name);
}

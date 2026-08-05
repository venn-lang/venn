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

/**
 * Which kind of declaration a node is, in the words a `deco` writes.
 *
 * Named for what it answers rather than `kindOf`, which `value/` owns and uses
 * for the other question entirely: what kind of *value* something is. Two
 * exported names alike is how `core/src/index.ts`, which is a stack of
 * `export *`, silently shadows one with the other.
 */
export function targetKindOf(node: AstNode): TargetKind {
  return BY_TYPE[node.$type] ?? "Node";
}

/** Whether a written type name is one of the kinds. */
export function isTargetKind(name: string): name is TargetKind {
  return (TARGET_KINDS as readonly string[]).includes(name);
}

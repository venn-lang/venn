import type { RecordSpec } from "@venn/types";
import type { AstNode } from "langium";
import { describe, expect, it } from "vitest";
import { walkAst } from "../ast/index.js";
import { makeHandle, TARGET_KINDS, type TargetKind } from "../expand/index.js";
import { parse } from "../parse/index.js";
import { KIND_SPECS } from "./kind-types.js";

/** One declaration of every kind, so each handle is built over a real node. */
const SOURCE = [
  "fn f(a) => a",
  'flow "F" { step "s" { } }',
  "const b = 1",
  "type T { x: string }",
  "fragment helper() { expect true }",
].join("\n");

/** Which declaration each kind is demonstrated by. `Node` is anything at all. */
const NODE_TYPES: Readonly<Record<TargetKind, string>> = {
  Fn: "FnDecl",
  Flow: "FlowDecl",
  Step: "StepDecl",
  Binding: "LetStmt",
  Type: "TypeDecl",
  Node: "FragmentDecl",
};

function nodesByType(): Map<string, AstNode> {
  const { ast, problems } = parse(SOURCE);
  expect(problems).toEqual([]);
  const found = new Map<string, AstNode>();
  for (const node of walkAst(ast)) {
    if (!found.has(node.$type)) found.set(node.$type, node);
  }
  return found;
}

/** The verbs a kind's handle actually answers, as opposed to refuses. */
function offered(kind: TargetKind, node: AstNode): string[] {
  const handle = makeHandle({ node, kind }) as Record<string, unknown>;
  return Object.getOwnPropertyNames(handle).filter((verb) => answers(handle, verb));
}

function answers(handle: Record<string, unknown>, verb: string): boolean {
  try {
    handle[verb];
    return true;
  } catch {
    return false;
  }
}

function published(kind: TargetKind): string[] {
  const spec = KIND_SPECS[kind];
  expect(spec.kind).toBe("record");
  return Object.keys((spec as RecordSpec).fields);
}

/**
 * The published types and the handle are two descriptions of one surface: what
 * a decorator can do to what it decorates. This is the seam where they would
 * quietly disagree: a verb added to the handle and never typed, or typed and
 * never built. The day one moves without the other, this is what says so.
 */
describe("what a kind publishes is what its handle offers", () => {
  const nodes = nodesByType();

  for (const kind of TARGET_KINDS) {
    it(`agrees about ${kind}`, () => {
      const node = nodes.get(NODE_TYPES[kind]);
      expect(node, `no ${NODE_TYPES[kind]} in the sample`).toBeDefined();

      expect(new Set(offered(kind, node as AstNode))).toEqual(new Set(published(kind)));
    });
  }
});

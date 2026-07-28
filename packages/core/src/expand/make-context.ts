import type { AstNode } from "langium";
import { buildProblem } from "../codes/index.js";
import { evaluate } from "../expr/index.js";
import type { Annotation } from "../generated/ast.js";
import { isRef } from "../generated/ast.js";
import type { Problem } from "../problem/index.js";
import type { ExpandContext } from "./expand.types.js";
import { writeMeta } from "./node-meta.js";
import { spanOf } from "./node-span.js";
import { swapNode } from "./swap-node.js";

/**
 * The handle one decorator gets on one node.
 *
 * `replace` and `remove` write straight into the parent's own array or field.
 * That is the tree the checker and the runtime read, not a copy of it, so a
 * decorator's rewrite is indistinguishable downstream from source the author
 * wrote by hand.
 */
export function makeContext(args: {
  node: AstNode;
  annotation: Annotation;
  uri?: string;
  problems: Problem[];
}): ExpandContext {
  const { node, annotation } = args;
  return {
    node,
    parent: node.$container,
    args: evaluatedArgs(annotation),
    // The expressions as written, for a decorator that needs the tree and not
    // the value: a macro reads its argument, it does not compute it.
    written: (annotation.args?.args ?? []).map((arg) => arg.value),
    replace: (next) => swapNode(node, next),
    remove: () => swapNode(node, undefined),
    meta: (key, value) => writeMeta(node, key, value),
    reject: (rejection) => args.problems.push(problemOf({ ...args, ...rejection })),
  };
}

/**
 * A decorator's arguments are evaluated once, here, against nothing.
 *
 * They are written before the program runs and cannot depend on it: `@retry(2)`
 * is part of the shape of the program, not of its execution. That is also why a
 * bare name inside one is a *word* and not a variable. `@tags(smoke)` and
 * `@scope(worker)` name a tag and a lifetime, and nothing exists yet for them to
 * refer to.
 */
function evaluatedArgs(annotation: Annotation): unknown[] {
  const nothing = { lookup: () => undefined };
  return (annotation.args?.args ?? []).map((arg) =>
    isRef(arg.value) ? arg.value.name : evaluate(arg.value, nothing),
  );
}

/** A decorator names its own code, so a plugin can refuse a program in its own terms. */
function problemOf(args: {
  annotation: Annotation;
  uri?: string;
  code: string;
  title: string;
}): Problem {
  return buildProblem({
    spec: { code: args.code, severity: "error" },
    span: spanOf(args.annotation, args.uri ?? "memory://inline.vn"),
    title: args.title,
  });
}

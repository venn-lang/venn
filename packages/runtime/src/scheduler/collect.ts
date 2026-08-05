import {
  type Block,
  type Document,
  evaluate,
  type FragmentDecl,
  isConfigDecl,
  isFragmentDecl,
  isLifecycleDecl,
  type LifecycleDecl,
  type Statement,
} from "@venn-lang/core";
import { createScope } from "../scope/index.js";

/** Lifecycle blocks that belong to a scope, grouped by hook. */
export interface LifecycleHooks {
  setup: LifecycleDecl[];
  teardown: LifecycleDecl[];
  beforeEach: LifecycleDecl[];
  afterEach: LifecycleDecl[];
}

/** Index the document's fragments by name for `run`. */
export function collectFragments(doc: Document): Map<string, FragmentDecl> {
  const map = new Map<string, FragmentDecl>();
  for (const decl of doc.decls) {
    if (isFragmentDecl(decl)) map.set(decl.name, decl);
  }
  return map;
}

/** Evaluate the top-level `config { … }` block with `env` bound, for the action context. */
export function collectConfig(
  doc: Document,
  env: Record<string, unknown>,
): Record<string, unknown> {
  const decl = doc.decls.find(isConfigDecl);
  if (!decl) return {};
  const scope = createScope();
  scope.set("env", env);
  return evaluate(decl.body, scope) as Record<string, unknown>;
}

/** Gather top-level setup/teardown/beforeEach/afterEach blocks. */
export function collectHooks(doc: Document): LifecycleHooks {
  const hooks: LifecycleHooks = { setup: [], teardown: [], beforeEach: [], afterEach: [] };
  for (const decl of doc.decls) {
    if (isLifecycleDecl(decl)) addHook(hooks, decl);
  }
  return hooks;
}

/**
 * The same four hooks, written inside a block instead of at the top of a file.
 *
 * They mean there what they mean there: `setup` before this block's statements,
 * `teardown` after them. Undefined rather than four empty lists, because almost
 * no block writes one and the walk over those that do is the slow path.
 */
export function collectBlockHooks(block: Block): LifecycleHooks | undefined {
  let hooks: LifecycleHooks | undefined;
  for (const stmt of block.stmts) {
    if (!isNamedHook(stmt)) continue;
    hooks ??= { setup: [], teardown: [], beforeEach: [], afterEach: [] };
    addHook(hooks, stmt);
  }
  return hooks;
}

/**
 * A hook that belongs to the block around it rather than to the run.
 *
 * `defer` is left out because it is registered as it is reached rather than
 * gathered up front, and `on` because it reacts to a verdict, not to a place.
 *
 * @param stmt Any statement of a block.
 * @returns True for `setup`, `teardown`, `beforeEach` and `afterEach`.
 */
export function isNamedHook(stmt: Statement): stmt is LifecycleDecl {
  return isLifecycleDecl(stmt) && NAMED[stmt.hook ?? ""] === true;
}

/** The four a block can own, written out because `defer` and `on` are not among them. */
const NAMED: Record<string, true> = {
  setup: true,
  teardown: true,
  beforeEach: true,
  afterEach: true,
};

/** Gather the `on <event> { … }` handlers a flow declared, for one event. */
export function collectOn(stmts: readonly unknown[], event: string): LifecycleDecl[] {
  return stmts.filter(
    (stmt): stmt is LifecycleDecl => isLifecycleDecl(stmt) && stmt.event === event,
  );
}

function addHook(hooks: LifecycleHooks, decl: LifecycleDecl): void {
  const bucket = hooks[decl.hook as keyof LifecycleHooks];
  if (bucket) bucket.push(decl);
}

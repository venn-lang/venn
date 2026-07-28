import {
  type Document,
  evaluate,
  type FragmentDecl,
  isConfigDecl,
  isFragmentDecl,
  isLifecycleDecl,
  type LifecycleDecl,
} from "@venn-lang/core";
import { createScope } from "../scope/index.js";

/** Top-level lifecycle blocks, grouped by hook. */
export interface SuiteHooks {
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
export function collectHooks(doc: Document): SuiteHooks {
  const hooks: SuiteHooks = { setup: [], teardown: [], beforeEach: [], afterEach: [] };
  for (const decl of doc.decls) {
    if (isLifecycleDecl(decl)) addHook(hooks, decl);
  }
  return hooks;
}

/** Gather the `on <event> { … }` handlers a flow declared, for one event. */
export function collectOn(stmts: readonly unknown[], event: string): LifecycleDecl[] {
  return stmts.filter(
    (stmt): stmt is LifecycleDecl => isLifecycleDecl(stmt) && stmt.event === event,
  );
}

function addHook(hooks: SuiteHooks, decl: LifecycleDecl): void {
  const bucket = hooks[decl.hook as keyof SuiteHooks];
  if (bucket) bucket.push(decl);
}

import { createScope, type Scope } from "../scope/index.js";
import { bindNamespaces } from "./bind-namespaces.js";
import { bindPrelude } from "./bind-prelude.js";
import type { Engine } from "./engine.types.js";

/**
 * What every scope in a run starts as: the prelude, the plugin namespaces and
 * `env`, plus the matrix variant when there is one.
 *
 * One place, shared by test runs and program runs, so `venn test` and `venn run`
 * cannot drift apart. Every scope a module is read in starts here too, which is
 * what makes an imported function see the same world its own file did.
 */
export function createBaseScope(args: {
  engine: Engine;
  /** The `matrix` variant, for a test run. A program has none. */
  variant?: Record<string, unknown>;
}): Scope {
  const scope = createScope();
  bindPrelude(scope);
  bindNamespaces({ registry: args.engine.registry, ctx: args.engine.ctx, scope });
  scope.set("env", args.engine.env);
  if (args.variant) scope.set("matrix", args.variant);
  return scope;
}

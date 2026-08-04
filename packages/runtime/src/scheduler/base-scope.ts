import type { Document } from "@venn-lang/core";
import { namespacesInFile, readImports } from "../imports/index.js";
import type { Registry } from "../registry/index.js";
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
/**
 * The constants this file imported by name, under the name it wrote.
 *
 * `import { pi } from "venn/math"` puts `pi` in scope; `math.pi` still works for
 * whoever imported the namespace instead, and both read the same value.
 */
function bindImportedValues(document: Document, registry: Registry, scope: Scope): void {
  const published = new Map(
    registry.values().map((one) => [`${one.namespace}.${one.value.name}`, one.value.value]),
  );
  for (const [local, qualified] of readImports(document, registry).values) {
    if (published.has(qualified)) scope.set(local, published.get(qualified));
  }
}

export function createBaseScope(args: {
  engine: Engine;
  /** The `matrix` variant, for a test run. A program has none. */
  variant?: Record<string, unknown>;
  /** The file being run, so a namespace answers to the name it imported it as. */
  document?: Document;
}): Scope {
  const scope = createScope();
  bindPrelude(scope);
  const named = args.document ? namespacesInFile(args.document, args.engine.registry) : undefined;
  bindNamespaces({ engine: args.engine, scope, named });
  if (args.document) bindImportedValues(args.document, args.engine.registry, scope);
  scope.set("env", args.engine.env);
  if (args.variant) scope.set("matrix", args.variant);
  return scope;
}

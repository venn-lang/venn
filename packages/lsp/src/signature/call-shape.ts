import { PRELUDE_SPECS } from "@venn/core";
import { type ActionDefinition, type ArgSpec, paramSpecs } from "@venn/sdk";
import { type FnSpec, showSpec } from "@venn/types";
import type { SymbolCatalog } from "../catalog/index.js";
import type { CallShape, ShownArg } from "./call-shape.types.js";

/**
 * What `target` takes, as the editor describes it back.
 *
 * A verb people can call is a verb people can be told about, whether a plugin
 * contributes it or the prelude does. Returns undefined only when nothing in
 * the language answers to that name.
 */
export function callShape(target: string, catalog: SymbolCatalog): CallShape | undefined {
  const dot = target.indexOf(".");
  if (dot < 0) return preludeShape(target);
  const entry = catalog.action(target.slice(0, dot), target.slice(dot + 1));
  if (!entry) return undefined;
  return {
    target,
    args: entry.action.args ? shownArgs(entry.action.args) : unnamed(entry.action.signature),
    options: paramSpecs(entry.action.params),
    doc: entry.action.doc,
    returns: returnOf(entry.action),
  };
}

/** The same, for a bareword matcher: `expect res contains "ok"`. */
export function matcherShape(name: string, catalog: SymbolCatalog): CallShape | undefined {
  const entry = catalog.matcher(name);
  if (!entry) return undefined;
  return {
    target: name,
    args: shownArgs(entry.matcher.args ?? []),
    options: paramSpecs(entry.matcher.params),
    doc: entry.matcher.appliesTo ? `Applies to ${entry.matcher.appliesTo}.` : undefined,
  };
}

/**
 * What the verb gives back, in the language's own words.
 *
 * Read from the declared type, never from prose beside it: a second place to
 * say the same thing is a second place to say it differently.
 */
function returnOf(action: ActionDefinition): string | undefined {
  const result = action.signature?.result;
  // Nothing worth saying about a verb that answers nothing.
  if (!result || (result.kind === "prim" && result.name === "void")) return undefined;
  return showSpec(result);
}

/** Published argument specs as the editor shows them. */
export function shownArgs(specs: readonly ArgSpec[]): readonly ShownArg[] {
  return specs.map(shownArg);
}

/**
 * What can still be said about a verb whose author named nothing: how many
 * arguments it takes, and of what. Worse than a name and far better than
 * silence, and the only thing a plugin from outside this repo may ever offer.
 */
function unnamed(signature: FnSpec | undefined): readonly ShownArg[] {
  return (signature?.params ?? []).map((type) => ({ name: "", type: showSpec(type) }));
}

function shownArg(spec: ArgSpec): ShownArg {
  return {
    name: spec.name,
    type: showSpec(spec.type),
    doc: spec.doc,
    optional: spec.optional,
    rest: spec.rest,
  };
}

/**
 * The prelude describes itself already: the checker reads its types and the
 * editor its prose. This reads the same table, so the two never disagree.
 */
function preludeShape(name: string): CallShape | undefined {
  const spec = PRELUDE_SPECS[name];
  if (!spec) return undefined;
  return {
    target: name,
    args: (spec.args ?? []).map((each) => ({ ...each })),
    options: [],
    doc: spec.doc,
  };
}

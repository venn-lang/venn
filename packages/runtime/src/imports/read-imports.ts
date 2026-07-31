import {
  type Document,
  isPackageSpecifier,
  isValueImport,
  type ValueImport,
} from "@venn-lang/core";
import type { PluginDefinition } from "@venn-lang/sdk";
import type { Registry } from "../registry/index.js";
import type { Imported, UnknownImport } from "./imports.types.js";

/**
 * Read what a file brought in from the packages it names.
 *
 * Everything a plugin publishes arrives by name: the namespace its verbs hang
 * off, the matchers `expect` may use, the types an annotation may write and the
 * decorators an `@` may reach. A name nobody imported does not work here, which
 * is what makes the top of the file the answer to where something came from.
 *
 * @param document The file being read.
 * @param registry The plugins the run loaded, which is where the answers are.
 * @returns What each imported name is, and the ones the package does not have.
 */
export function readImports(document: Document, registry: Registry): Imported {
  const state = blank();
  for (const decl of document.imports) {
    if (!isValueImport(decl) || !isPackageSpecifier(decl.path)) continue;
    const plugin = registry.plugin(decl.path);
    if (plugin) take(decl, plugin, state);
  }
  return state;
}

interface Mutable {
  namespaces: Map<string, string>;
  matchers: Map<string, string>;
  types: Map<string, string>;
  values: Map<string, string>;
  decos: Map<string, string>;
  unknown: UnknownImport[];
}

function blank(): Mutable {
  return {
    namespaces: new Map(),
    matchers: new Map(),
    types: new Map(),
    values: new Map(),
    decos: new Map(),
    unknown: [],
  };
}

function take(decl: ValueImport, plugin: PluginDefinition, into: Mutable): void {
  // `import * as h from "venn/http"` names the whole plugin, which is its
  // namespace: there is one bag of verbs, and this is what to call it.
  if (decl.wildcard) return void into.namespaces.set(decl.wildcard, plugin.namespace);
  for (const one of decl.names)
    place({ local: one.alias ?? one.name, name: one.name, plugin, into });
}

function place(args: {
  local: string;
  name: string;
  plugin: PluginDefinition;
  into: Mutable;
}): void {
  const { local, name, plugin, into } = args;
  if (name === plugin.namespace) return void into.namespaces.set(local, plugin.namespace);
  if (plugin.matchers?.some((matcher) => matcher.name === name)) {
    return void into.matchers.set(local, name);
  }
  if (plugin.typeDefs && name in plugin.typeDefs) {
    return void into.types.set(local, `${plugin.namespace}.${name}`);
  }
  if (plugin.decorators?.some((deco) => deco.name === name)) {
    return void into.decos.set(local, name);
  }
  // A constant is a value like any other, so it arrives by name the way one from
  // another file does: `import { pi } from "venn/math"`.
  if (plugin.values?.some((value) => value.name === name)) {
    return void into.values.set(local, `${plugin.namespace}.${name}`);
  }
  into.unknown.push({ pkg: plugin.name, name, note: whatItIs(name, plugin) });
}

/**
 * Why the name is not there, when the package has something by that name that a
 * name cannot reach. A verb is the everyday case: it hangs off the namespace,
 * so the namespace is what an import asks for.
 */
function whatItIs(name: string, plugin: PluginDefinition): string | undefined {
  const verb = plugin.actions?.some((action) => action.name === name);
  if (!verb) return undefined;
  return `It is a verb: import \`{ ${plugin.namespace} }\` and write \`${plugin.namespace}.${name}\`.`;
}

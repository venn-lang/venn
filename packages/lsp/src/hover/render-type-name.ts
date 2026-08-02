import { BUILTIN_TYPES, KIND_SPECS, TARGET_KINDS } from "@venn-lang/core";
import type { RecordSpec, TypeSpec } from "@venn-lang/types";
import { showSpec } from "@venn-lang/types";
import type { SymbolCatalog } from "../catalog/index.js";
import { code, fence, labelled, rule, sections } from "../markdown/index.js";

/** What each decorator handle is a handle *on*, in the user's words. */
const DECORATES: Readonly<Record<string, string>> = {
  Fn: "a `fn`, its parameters, and what happens around a call to it",
  Flow: "a `flow`, its title, and what happens around its body",
  Step: "a `step`, its title, and what happens around its body",
  Binding: "a `let` or `const`, the value it holds",
  Type: "a `type`, the fields it declares",
  Node: "any declaration at all, by name",
};

/**
 * Hover for a type written in an annotation: `target: Fn`, `x: string`.
 *
 * A type name is where the reader most needs telling. Unanswered, `Fn` looks
 * like a name someone made up rather than the surface the body is about to use.
 */
export function typeNameHover(name: string, catalog: SymbolCatalog): string | undefined {
  return builtinHover(name) ?? kindHover(name) ?? publishedHover(name, catalog);
}

/** One of the language's own types: `string`, `duration`, `dynamic`. */
function builtinHover(name: string): string | undefined {
  const builtin = BUILTIN_TYPES[name];
  if (!builtin) return undefined;
  return rule([
    fence(name),
    sections([builtin.doc, labelled("Written", fence(builtin.example))]),
    "**Built in**: part of the language, no `use` needed.",
  ]);
}

/** One of the seven decorator handles. */
function kindHover(name: string): string | undefined {
  if (!TARGET_KINDS.includes(name as (typeof TARGET_KINDS)[number])) return undefined;
  const spec = KIND_SPECS[name as keyof typeof KIND_SPECS];
  return rule([
    fence(`${name}, a decorator target`),
    sections([
      `Written as a \`deco\`'s first parameter, it decorates ${DECORATES[name] ?? "a declaration"}.`,
      membersBlock(spec),
    ]),
    "The body runs at expansion time, before the program exists.",
  ]);
}

/** A type a plugin published: `http.Response`, `db.Row`. */
function publishedHover(name: string, catalog: SymbolCatalog): string | undefined {
  const dot = name.indexOf(".");
  if (dot < 0) return undefined;
  const found = catalog
    .typesIn(name.slice(0, dot))
    .find((entry) => entry.name === name.slice(dot + 1));
  if (!found) return undefined;
  return rule([
    fence(`${found.namespace}.${found.name}`),
    membersBlock(found.spec),
    `**Package** ${code(found.package)}`,
  ]);
}

/**
 * One line per member, rather than one line for all of them. A handle carries
 * ten verbs, and rendered end to end they run past the edge of any hover.
 */
function membersBlock(spec: TypeSpec): string | undefined {
  if (spec.kind !== "record") return undefined;
  const fields = Object.entries((spec as RecordSpec).fields);
  if (fields.length === 0) return undefined;
  const lines = fields.map(([field, type]) => `- ${code(field)}: ${code(showSpec(type))}`);
  return labelled("Offers", lines.join("\n"));
}

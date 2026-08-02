import {
  createContext,
  MEMBER_DOCS,
  memberKind,
  memberType,
  PRELUDE_SPECS,
  type PreludeArg,
  resolveMember,
  showType,
  type Type,
} from "@venn-lang/core";
import type { SymbolCatalog } from "../catalog/index.js";
import { code, fence, labelled, rule, sections } from "../markdown/index.js";

/**
 * Hover for a prelude name: `range`, `str`, `print`. They belong to no
 * namespace and are declared nowhere, so without this they read as an unknown
 * variable of type `dynamic`.
 */
export function preludeHover(name: string): string | undefined {
  const spec = PRELUDE_SPECS[name];
  if (!spec) return undefined;
  return rule([
    fence(spec.signature),
    sections([spec.doc, argumentsBlock(spec.args), example(spec.example)]),
    "**Prelude**, available without `use`.",
  ]);
}

/** One line per argument, laid out as an action's is; a verb is a verb. */
function argumentsBlock(args: readonly PreludeArg[] | undefined): string | undefined {
  if (!args?.length) return undefined;
  const lines = args.map((arg) => {
    const doc = arg.doc ? `, ${arg.doc}` : "";
    return `- ${code(arg.name)}: ${code(arg.type)}${arg.optional ? " *(optional)*" : ""}${doc}`;
  });
  return labelled("Arguments", lines.join("\n"));
}

/**
 * Hover for a namespace itself (`fmt`, `http`). A namespace is not a map: it is
 * the set of verbs a package contributes, and saying so keeps anyone from
 * reading its members like data.
 */
export function namespaceHover(name: string, catalog: SymbolCatalog): string | undefined {
  if (!catalog.hasNamespace(name)) return undefined;
  const actions = catalog.actionsIn(name);
  const shown = actions.slice(0, 8).map((entry) => code(`${name}.${entry.name}`));
  const more = actions.length > shown.length ? `, …${actions.length - shown.length} more` : "";
  return rule([
    fence(`namespace ${name}`),
    sections([
      `Contributes ${actions.length} verb${actions.length === 1 ? "" : "s"}.`,
      actions.length > 0 ? labelled("Verbs", `${shown.join(", ")}${more}`) : undefined,
    ]),
    `**Package** ${catalog.packagesFor(name).map(code).join(", ")}`,
  ]);
}

/**
 * Hover for a built-in member of a native value: `xs.map`, `name.slugify`.
 * The signature comes from the receiver's inferred type, so `xs.first` on a
 * `list<number>` reads as `number`, not as a type variable.
 */
export function memberHover(args: { receiver: Type; member: string }): string | undefined {
  const kind = memberKind(args.receiver);
  const doc = kind && MEMBER_DOCS[kind]?.[args.member];
  if (!doc) return fieldHover(args);
  if (!kind) return undefined;
  const type = memberType(args.receiver, args.member, createContext());
  const shown = type ? ` -> ${showType(type)}` : "";
  return rule([
    fence(`${kind}.${args.member}${shown}`),
    sections([doc.doc, example(doc.example)]),
    `**Built in**, on every ${code(kind)}.`,
  ]);
}

/** A key the data itself carries: `p.age` on `{ name: string, age: number }`. */
function fieldHover(args: { receiver: Type; member: string }): string | undefined {
  const type = resolveMember(args.receiver, args.member, createContext());
  if (!type) return undefined;
  return rule([
    fence(`${args.member}: ${showType(type)}`),
    `**Field** of ${code(showType(args.receiver))}.`,
    shaping(type),
  ]);
}

/**
 * How to get somewhere from a value nothing can know the shape of.
 *
 * `dynamic` is honest: a parsed response is whatever the far end sent, and no
 * checker can say more. Honesty without a way forward reads as a dead end, so
 * the hover spells out the way: name a type and annotate the binding.
 */
function shaping(type: Type): string | undefined {
  if (type.kind !== "dynamic") return undefined;
  return [
    "**Shape it by naming one**, nothing can know what this holds, so say what you expect:",
    fence("type Price { symbol: string, price: number }\nconst price: Price = res.json"),
    "From there it reads as a `Price`: members are offered, and a wrong one is an error.",
  ].join("\n\n");
}

function example(source: string | undefined): string | undefined {
  return source ? labelled("Example", fence(source)) : undefined;
}

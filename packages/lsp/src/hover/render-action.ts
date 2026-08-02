import { type ParamSpec, paramSpecs } from "@venn-lang/sdk";
import type { ActionEntry, MatcherEntry, SymbolCatalog } from "../catalog/index.js";
import { code, fence, labelled, rule, sections } from "../markdown/index.js";
import { callShape, type ShownArg, shownArgs } from "../signature/index.js";
import { preludeHover } from "./render-symbol.js";

/** Hover for `namespace.action`, or for a prelude verb like `log`. */
export function actionHover(target: string, catalog: SymbolCatalog): string | undefined {
  const dot = target.indexOf(".");
  if (dot < 0) return preludeHover(target);
  const entry = catalog.action(target.slice(0, dot), target.slice(dot + 1));
  return entry && renderAction(entry, catalog);
}

/** Hover for a bareword matcher used after `expect`. */
export function matcherHover(name: string, catalog: SymbolCatalog): string | undefined {
  const entry = catalog.matcher(name);
  return entry && renderMatcher(entry);
}

function renderAction(entry: ActionEntry, catalog: SymbolCatalog): string {
  const target = `${entry.namespace}.${entry.name}`;
  const shape = callShape(target, catalog);
  const returns = shape?.returns ? ` -> ${shape.returns}` : "";
  const body = sections([
    entry.action.doc,
    argumentsBlock(shape?.args ?? []),
    optionsBlock(paramSpecs(entry.action.params)),
  ]);
  return rule([
    fence(`${signatureLine(target, shape?.args ?? [])}${returns}`),
    body || undefined,
    WHAT_IT_IS,
    `**Package** ${code(entry.package)}`,
  ]);
}

/**
 * What kind of thing this is, said outright.
 *
 * A `fn` hover carries the word `fn` and needs no explaining. A verb carries
 * nothing that tells it apart from a function the reader could hold, which is
 * exactly what it is not.
 */
const WHAT_IT_IS =
  "**Verb**, a package contributes it, it reaches the world outside, and the program waits for it without saying so. Naming it calls it; it is not a value you can hold.";

/** The call as it is written: `http.on server handler`, with no brackets. */
function signatureLine(target: string, args: readonly ShownArg[]): string {
  const written = args.map((each) => (each.optional ? `${each.name}?` : each.name)).filter(Boolean);
  return [target, ...written].join(" ");
}

/** One line per positional argument: the half a Zod schema never describes. */
function argumentsBlock(args: readonly ShownArg[]): string | undefined {
  const named = args.filter((each) => each.name);
  if (named.length === 0) return undefined;
  return labelled("Arguments", named.map(argumentLine).join("\n"));
}

function argumentLine(arg: ShownArg): string {
  const optional = arg.optional ? " *(optional)*" : "";
  const doc = arg.doc ? `, ${arg.doc}` : "";
  return `- ${code(arg.name)}: ${code(arg.type)}${optional}${doc}`;
}

function renderMatcher(entry: MatcherEntry): string {
  const applies = entry.matcher.appliesTo
    ? `Applies to ${code(entry.matcher.appliesTo)}.`
    : undefined;
  const args = shownArgs(entry.matcher.args ?? []);
  const body = sections([
    applies,
    argumentsBlock(args),
    optionsBlock(paramSpecs(entry.matcher.params)),
  ]);
  return rule([
    fence(signatureLine(`expect <subject> ${entry.name}`, args)),
    body || undefined,
    `**Package** ${code(entry.package)}`,
  ]);
}

/** One line per key: what to write, whether it is required, and what it means. */
function optionsBlock(specs: ParamSpec[]): string | undefined {
  if (specs.length === 0) return undefined;
  return labelled("Options", specs.map(optionLine).join("\n"));
}

function optionLine(spec: ParamSpec): string {
  const required = spec.required ? " *(required)*" : "";
  const doc = spec.doc ? `, ${spec.doc}` : "";
  return `- ${code(spec.name)}: ${code(spec.type)}${required}${doc}`;
}

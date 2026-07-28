import { UriUtils } from "langium";
import { code, fence, rule, sections } from "../markdown/index.js";
import { decoratorDoc } from "./builtin-docs.js";
import type { DecoInfo } from "./deco.types.js";

/**
 * Hover for a decorator: the same text whether the cursor sits on `@memoize`
 * or on the `deco memoize` that defines it. They are one thing seen twice, so
 * they read the same.
 */
export function decoHover(info: DecoInfo): string {
  return rule([fence(info.signature), sections([decorates(info), info.doc]), origin(info)]);
}

/**
 * A decorator the language documents but no source declares, such as `@load`
 * until `@venn/load` contributes it. Explaining it beats saying nothing.
 */
export function documentedHover(name: string): string | undefined {
  const doc = decoratorDoc(name);
  return doc && rule([fence(`@${name}`), doc]);
}

/** What it decorates, in one phrase: the detail beside a completion item. */
export function decoratesLabel(decorates: readonly string[]): string {
  const named = namedKinds(decorates);
  return named.length > 0 ? named.join(", ") : "anything";
}

function decorates(info: DecoInfo): string {
  const named = namedKinds(info.decorates);
  if (named.length === 0) return "Decorates **anything**.";
  return `Decorates ${named.map(code).join(", ")}.`;
}

// `Node` is how a target says "anything", so it names nothing in particular.
function namedKinds(decorates: readonly string[]): string[] {
  return decorates.filter((kind) => kind !== "Node");
}

function origin(info: DecoInfo): string {
  if (!info.document) return "Built into the language.";
  return `Declared in ${code(UriUtils.basename(info.document.uri))}`;
}

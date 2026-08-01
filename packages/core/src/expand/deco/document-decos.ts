import type { Document } from "../../generated/ast.js";
import { isDecoDecl } from "../../generated/ast.js";
import type { Problem } from "../../problem/index.js";
import type { DecoratorDefinition, DecoratorSource } from "../expand.types.js";
import type { ImportedDeco } from "./deco.types.js";
import { decoDecorator } from "./deco-decorator.js";

/** Every `deco` one document can reach, and the file it is being expanded for. */
export interface DocumentDecoArgs {
  document: Document;
  decorators: DecoratorSource;
  uri: string;
  problems: Problem[];
  /** The `pub deco`s this file's imports reach, by name. */
  imported?: ReadonlyMap<string, ImportedDeco>;
}

/**
 * The document's own `deco`s, then the ones it imported, layered over whatever
 * the host contributed.
 *
 * A local declaration wins against a plugin's and against a built-in of the same
 * name: the more local one is what the author is looking at. All of them arrive
 * as ordinary members of one {@link DecoratorSource}, so `@memoize` resolves
 * without expansion ever asking where a decorator came from.
 */
export function withDocumentDecos(args: DocumentDecoArgs): DecoratorSource {
  const own = ownDecos(args);
  const shared = sharedDecos(args);
  if (own.size === 0 && !shared) return args.decorators;
  return {
    get: (name) => own.get(name) ?? shared?.(name) ?? args.decorators.get(name),
    names: () => [
      ...new Set([...own.keys(), ...(args.imported?.keys() ?? []), ...args.decorators.names()]),
    ],
  };
}

/** Built up front: a signature that does not read is reported where it is written. */
function ownDecos(args: DocumentDecoArgs): Map<string, DecoratorDefinition> {
  const own = new Map<string, DecoratorDefinition>();
  for (const decl of args.document.decls) {
    if (isDecoDecl(decl)) own.set(decl.name, decoDecorator({ ...args, decl }));
  }
  return own;
}

type Found = DecoratorDefinition | undefined;

/**
 * Built on first use, and remembered.
 *
 * An imported file exports every `pub deco` it has, and this one may write none
 * of them: reading a signature nobody asked for would charge another file's
 * fault to this one, for a decorator that was never applied.
 */
function sharedDecos(args: DocumentDecoArgs): ((name: string) => Found) | undefined {
  const imported = args.imported;
  if (!imported || imported.size === 0) return undefined;
  const built = new Map<string, Found>();
  return (name) => {
    if (built.has(name)) return built.get(name);
    const from = imported.get(name);
    // Its own uri, so a fault in it points at the line that wrote it.
    const made = from && decoDecorator({ ...args, decl: from.decl, uri: from.uri });
    built.set(name, made);
    return made;
  };
}

import { expand, type ImportedDeco } from "../expand/index.js";
import type { DecoDecl, Document } from "../generated/ast.js";
import { isTypeDecl } from "../generated/ast.js";

/**
 * Runs the decorators that change a shape, before anything is checked against
 * one.
 *
 * A `deco` that calls `target.addField` rewrites the type it sits on, and until
 * it has run the checker is looking at a shape the program never has. That made
 * a shape decorator unusable in any file that also checks: the run was right and
 * the check was wrong about the same line.
 *
 * Only declarations of types are expanded. A decorator that wraps a function
 * changes nothing the checker can see, and running it here would mean `venn
 * check` executing bodies to learn nothing.
 *
 * Decorators contributed by plugins are not reachable from here, since the
 * kernel does not know what a plugin is. One of those changing a shape is still
 * invisible to the checker.
 *
 * @param args The document, rewritten in place, and the `deco`s in reach.
 */
export function applyShapeDecorators(args: {
  document: Document;
  decos: ReadonlyMap<string, DecoDecl>;
  uri: string;
}): void {
  if (args.decos.size === 0) return;
  expand({
    document: args.document,
    decorators: { get: () => undefined, names: () => [] },
    uri: args.uri,
    imported: imported(args),
    only: isTypeDecl,
  });
}

/**
 * The `deco`s as expansion wants them.
 *
 * The uri is the document's own even for a `deco` that came from another file:
 * it is only used to place a problem, and every problem raised here is dropped.
 * The use sites are `checkDeco`'s to report, and saying it twice is what a
 * reader sees.
 */
function imported(args: {
  decos: ReadonlyMap<string, DecoDecl>;
  uri: string;
}): Map<string, ImportedDeco> {
  const found = new Map<string, ImportedDeco>();
  for (const [name, decl] of args.decos) found.set(name, { decl, uri: args.uri });
  return found;
}

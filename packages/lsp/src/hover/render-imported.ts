import { isDecoDecl, isFragmentDecl } from "@venn-lang/core";
import { UriUtils } from "langium";
import { declaredDeco, decoHover } from "../deco/index.js";
import type { ImportedLocation } from "../document/index.js";
import { code, fence, rule } from "../markdown/index.js";
import type { TypeService } from "../types/index.js";
import { declarationHover, fragmentHover } from "./render-decl.js";

export interface ImportedHoverArgs {
  location: ImportedLocation;
  name: string;
  types: TypeService;
}

/**
 * A name as it reads inside `import { … }`.
 *
 * Whatever the other file declared, described the way that file would describe
 * it, so importing a name and standing on its declaration read alike. The
 * import list is the one place a name is neither a declaration nor a use, so
 * nothing else in the hover reaches it.
 */
export function importedHover(args: ImportedHoverArgs): string | undefined {
  const { location, name } = args;
  const { decl, document } = location;
  if (!decl || !document) return unread(location, name);
  if (isFragmentDecl(decl)) return fragmentHover({ ...location, decl, document });
  if (isDecoDecl(decl)) return decoHover(declaredDeco({ decl, document }));
  return declarationHover({ document, node: decl, types: args.types });
}

/** The file could not be read, or declares no such name; say what is known. */
function unread(location: ImportedLocation, name: string): string {
  return rule([fence(name), `Imported from ${code(UriUtils.basename(location.uri))}.`]);
}

/**
 * The specifier itself: where `"#shared/auth.vn"` actually lands.
 *
 * An alias is the one specifier a reader cannot resolve in their head: it goes
 * through `[paths]` in `venn.toml`, which is a different file. Saying the
 * resolved path is the whole answer.
 */
export function importPathHover(args: { location: ImportedLocation; path: string }): string {
  const { location, path } = args;
  const file = code(UriUtils.basename(location.uri));
  const read = location.document ? `Resolves to ${file}.` : `Resolves to ${file} — not readable.`;
  return rule([fence(`from "${path}"`), read]);
}

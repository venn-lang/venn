import { declaredEnvNames } from "@venn-lang/contracts";
import type { LangiumDocument } from "langium";
import type { ImportResolver } from "../workspace/index.js";

/**
 * The variables this project declares, as every command sees them.
 *
 * The same answer `venn check` and `venn run` get, from the same function, so
 * the editor cannot be green where CI is red about a name in a `.env`. The
 * resolver has already folded the dotenv files into the sections, which is why
 * none are passed here.
 *
 * @param imports The project resolver, which reads the nearest `venn.toml`.
 * @param document The file being analysed, which is what says which project.
 * @returns Every declared name, or `undefined` where there is no manifest at
 * all: with nothing to compare against, every `env.*` read would look
 * undeclared.
 */
export function declaredEnv(
  imports: ImportResolver,
  document: LangiumDocument,
): readonly string[] | undefined {
  const sections = imports.env(document.uri);
  // An empty table is how the resolver says it found no manifest: a real one
  // always yields at least `local`, whether or not anything was written in it.
  return declaredEnvNames({ sections: Object.keys(sections).length > 0 ? sections : undefined });
}

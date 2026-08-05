import type { Document } from "@venn-lang/core";
import type { LangiumDocument } from "langium";

/**
 * The Venn tree inside a Langium document.
 *
 * Five files asked this for themselves, each spelling the same cast. Not named
 * `rootOf` because core exports an unrelated `rootOf` over lexical scopes, and
 * core's barrel is an `export *`: two of that name in scope is a shadow the
 * typechecker never mentions.
 *
 * @param document An open document, parsed or not.
 * @returns Its root `Document`, or nothing when the parse produced no value.
 */
export function documentRoot(document: LangiumDocument): Document | undefined {
  return document.parseResult?.value as Document | undefined;
}

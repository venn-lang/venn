/**
 * The prelude as the checker needs it: every name's signature, built once from
 * what `@venn-lang/prelude` publishes.
 *
 * The list itself lives there, in the wire format a plugin uses, so what comes
 * native is one thing anyone can read rather than a table inside the compiler.
 * This is only the reading of it.
 */

import { PRELUDE, type PreludeArg, type PreludeEntry } from "@venn-lang/prelude";
import { specToType } from "./spec-to-type.js";
import type { Type } from "./type.types.js";

export type { PreludeArg };

/** What the editor needs to describe a prelude name: its type, and what it is for. */
export interface PreludeSpec {
  /** How it reads when written out. Shown as the hover's signature. */
  signature: string;
  doc: string;
  example?: string;
  type: Type;
  /**
   * The arguments, one by one. `signature` above is a whole line meant to be
   * read; these are meant to be pointed at, one at a time, as each is typed.
   */
  args?: readonly PreludeArg[];
}

/** A prelude signature refers to no named type belonging to anyone else. */
const ALONE = (): Type | undefined => undefined;

/**
 * The prelude, described once: the checker reads the types, the editor reads the
 * prose. Two tables would drift; these come from the same entry, so they cannot.
 */
export const PRELUDE_SPECS: Readonly<Record<string, PreludeSpec>> = Object.fromEntries(
  Object.entries(PRELUDE).map(([name, entry]) => [name, specOf(entry)]),
);

function specOf(entry: PreludeEntry): PreludeSpec {
  const spec: PreludeSpec = {
    signature: entry.signature,
    doc: entry.doc,
    type: specToType(entry.type, ALONE),
  };
  if (entry.example !== undefined) spec.example = entry.example;
  if (entry.args !== undefined) spec.args = entry.args;
  return spec;
}

/** Whether a bare name is part of the prelude: no import needed, always in scope. */
export function isPrelude(name: string): boolean {
  return name in PRELUDE_SPECS;
}

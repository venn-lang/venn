import type { TypeSpec } from "@venn-lang/types";

/**
 * How a prelude name is reached.
 *
 * A value can be written anywhere a value goes, including inside an expression.
 * A verb is a statement the runtime carries out, so it has somewhere to write to
 * and something to record, and there is nothing to read back from it.
 */
export type PreludeKind = "value" | "verb";

/** One argument of a prelude name, named so the editor can point at it. */
export interface PreludeArg {
  readonly name: string;
  /** How the type reads to a person, which is not always how it is checked. */
  readonly type: string;
  /**
   * Required, because an argument of the language's own that nobody explains is
   * a gap in the one documentation every user reads without asking for it.
   */
  readonly doc: string;
  readonly optional?: boolean;
}

/**
 * One name the language brings with it, described once for everyone who has to
 * say what it is: the checker, the editor, and whoever reads the documentation.
 */
export interface PreludeEntry {
  readonly kind: PreludeKind;
  /** How it reads when written out. Shown as the hover's signature. */
  readonly signature: string;
  readonly doc: string;
  readonly example?: string;
  /** What the checker reads, in the same wire format a plugin publishes. */
  readonly type: TypeSpec;
  readonly args?: readonly PreludeArg[];
}

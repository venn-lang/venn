import type { ValueImport } from "@venn-lang/core";

/** What a file brought in by name, and what each of those names turned out to be. */
export interface Imported {
  /**
   * The namespaces this file may write, by the name it writes them under. A
   * name outside this map was never imported, however well the registry knows
   * it.
   */
  readonly namespaces: ReadonlyMap<string, string>;
  /** The matchers it may write after `expect`, by the name it writes. */
  readonly matchers: ReadonlyMap<string, string>;
  /** Local type name to the qualified one the catalog holds. */
  readonly types: ReadonlyMap<string, string>;
  /** Local name to the qualified constant it stands for: `pi` to `math.pi`. */
  readonly values: ReadonlyMap<string, string>;
  /** The `@name`s it brought in. */
  readonly decos: ReadonlyMap<string, string>;
  /** A name the package does not publish, kept to be reported where it is written. */
  readonly unknown: readonly UnknownImport[];
}

/** One name an import asked a package for and did not get. */
export interface UnknownImport {
  readonly pkg: string;
  readonly name: string;
  /** The import that asked, so the problem lands on it rather than on the file. */
  readonly decl: ValueImport;
  /** What it is, when the package has it as something a name cannot reach. */
  readonly note?: string;
}

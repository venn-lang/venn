import type { HostCapability } from "@venn-lang/contracts";
import type { AstNode, Document, Expr, ImportedDeco, Problem, Type } from "@venn-lang/core";
import type { PluginDefinition } from "@venn-lang/sdk";
import type { TypeSpec } from "@venn-lang/types";
import type { ImportCycle, UnreadableImport } from "../run/index.js";
import type { ImportGraph } from "../scheduler/index.js";

/** The plugins a host loaded, and what that host can actually do. */
export interface FrontEndArgs {
  plugins: readonly PluginDefinition[];
  /**
   * The capabilities to resolve actions against.
   *
   * A run negotiates against the host it will run on, so a verb the host cannot
   * supply is refused before anything happens. An editor negotiates against
   * every capability there is, because it describes the language rather than one
   * run of it.
   */
  caps: readonly HostCapability[];
}

/**
 * One file, and everything only the caller can know about the world around it.
 *
 * Nothing here is optional. Every field changes which problems come back, and
 * an optional one is how the editor lost VN2009: `checkImports` took the
 * registry as `registry?`, the validator did not pass it, and nothing said so
 * for a year. Where absence is meaningful it is written out, as `undefined` for
 * `env` or as an empty collection.
 */
export interface AnalyzeArgs {
  /** The parsed file. The CLI calls `parse`; the editor already has Langium's. */
  document: Document;
  uri: string;
  /**
   * Every module the import graph reached, and how one file names another.
   *
   * Resolved by the caller, never here. The CLI reads the disk and awaits it;
   * the editor reads its own index, synchronously, because the buffer being
   * typed into has not been written yet and reading it from disk is the wrong
   * bytes rather than the slow ones.
   */
  graph: ImportGraph;
  /** The `pub deco`s this file's imports reach, by the name an `@` writes. */
  decos: ReadonlyMap<string, ImportedDeco>;
  /** Which of the names this file imported are fragments. Its own are added here. */
  fragments: ReadonlySet<string>;
  /**
   * The variables the project declares, `name` among them.
   *
   * `undefined` says they could not be read, and then no `env.*` read is
   * refused: that error is only worth raising when the list is trustworthy.
   */
  env: readonly string[] | undefined;
  /** What each installed package publishes, derived at install from its types. */
  packages: ReadonlyMap<string, Record<string, TypeSpec>>;
  /**
   * Imports whose path was tried and answered nothing.
   *
   * Only a resolver that read knows. An absent module means "not there" to the
   * CLI and "not indexed yet" to the editor, and the editor must not draw an
   * error over a neighbour the workspace is still loading.
   */
  unreadable: readonly UnreadableImport[];
  /** Files that import each other, from the same resolver, for the same reason. */
  cycles: readonly ImportCycle[];
}

/** Everything one pass over one file worked out. */
export interface Analysis {
  /** Every problem every pass found, loudest first. Which to report is the caller's. */
  problems: readonly Problem[];
  /** Each expression's inferred type, which hover, completion and signature help read. */
  types: ReadonlyMap<AstNode, Type>;
  /** Per string literal, the expression parsed out of each `${…}`. */
  slots: ReadonlyMap<AstNode, readonly (Expr | undefined)[]>;
}

/** The front end: a parsed file in, every problem the language can name out. */
export interface FrontEnd {
  analyze(args: AnalyzeArgs): Analysis;
}

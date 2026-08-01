import type { DecoratorSource, Document } from "@venn-lang/core";
import type { Registry } from "../registry/index.js";

/** Inputs to a static name-resolution pass over a parsed document. */
export interface CheckArgs {
  document: Document;
  registry: Registry;
  fragments: ReadonlySet<string>;
  uri?: string;
  /**
   * The variables `venn.toml` declares. Omit it when they are unknown: an
   * undeclared-variable error is only worth raising when the declaration list is
   * trustworthy.
   */
  env?: readonly string[];
  /**
   * The decorators in reach, for refusing one nothing provides.
   *
   * Optional because resolving a name needs the plugins loaded, and a caller
   * that has none is better off saying nothing than refusing every decorator
   * there is.
   */
  decorators?: DecoratorSource;
  /**
   * The `pub deco`s this file's imports reach, by name.
   *
   * A `deco` travels the way a `pub fn` does, so a decorator can be declared one
   * file away and still be the right one here.
   */
  importedDecos?: Iterable<string>;
}

/** Everything a per-node check needs, resolved once per document. */
export interface CheckContext {
  registry: Registry;
  fragments: ReadonlySet<string>;
  aliases: ReadonlyMap<string, string>;
  /** Namespaces this file actually brought in with `use`. */
  imported: ReadonlySet<string>;
  /** The matchers this file brought in by name, which is how one arrives. */
  matchers: ReadonlySet<string>;
  /** Names this file binds: callable, but their methods cannot be verified. */
  bound: ReadonlySet<string>;
  /**
   * Every name the file binds anywhere, flat and over-collected.
   *
   * `bound` answers "is this callable"; this answers "does this name exist at
   * all", which is the only question a typo needs and the only one that can be
   * asked without tracking scope.
   */
  declared: ReadonlySet<string>;
  /** Every `deco` in reach: this file's own, and the ones it imported. */
  decos: ReadonlySet<string>;
  /** The decorators the host loaded, when the caller had them. */
  decorators?: DecoratorSource;
  /** Declared `env` variables, or undefined when the manifest could not be read. */
  env?: ReadonlySet<string>;
  uri: string;
}

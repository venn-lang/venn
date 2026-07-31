/**
 * The whole of what two hosts disagree about when they write a path down.
 *
 * Everything else, what `..` means and where a name ends, is the same
 * everywhere, so it is written once against this and not once per host.
 */
export interface Spelling {
  /** What this host writes between parts. */
  readonly separator: string;
  /** Every character that ends a part when reading one back. */
  readonly splitter: RegExp;
  /** Where this host's paths start when none is said. */
  readonly cwd: string;
  /**
   * The head of the path that is not a part of it: `/`, `C:\`, `\\server\share\`.
   *
   * Empty when the path starts nowhere in particular. A root that ends in a
   * separator is an absolute path, and one that does not (`C:`, which means
   * "wherever that drive is standing") is not.
   */
  rootOf(path: string): string;
  /**
   * That root as this host writes it, separator and all.
   *
   * `rootOf` answers with the text it found, so slicing it off the source is
   * exact. What goes back out has to be spelled one way, and has to carry its
   * own separator: everything after a root follows it with nothing in between.
   * A root written without one is a place the program has not been told yet,
   * which is what `C:` is and what makes it the one root that is not absolute.
   */
  write(root: string): string;
  /** Whether two names are the same one, which not every host answers alike. */
  same(left: string, right: string): boolean;
}

/**
 * How this host spells a path.
 *
 * Two hosts disagree about one thing that matters and a dozen that do not: the
 * separator, and what makes a path absolute. A program that hard-codes `"/"`
 * works until it does not, and the failure lands far from the concatenation
 * that caused it. So the spelling belongs to the host, and a program only ever
 * asks for the parts it knows.
 *
 * Everything here is answered by looking at the text, never by touching a disk.
 * A path to a file that does not exist still has a name and a parent, and
 * asking about them is how a program decides whether to create it.
 */
export interface Paths {
  /** What goes between one part and the next here: `/` or `\`. */
  readonly separator: string;
  /** Where the program is running from. Every relative path starts here. */
  cwd(): string;
  /**
   * The parts as one path, with exactly one separator between each.
   *
   * An empty part is skipped rather than doubling the separator, and a part
   * that is absolute starts the path over: joining onto `/etc` a `/tmp` means
   * `/tmp`, not a path that is somehow inside both.
   */
  join(parts: readonly string[]): string;
  /** The parts as one absolute path, starting from {@link cwd} if none is. */
  resolve(parts: readonly string[]): string;
  /**
   * How to get from one path to the other, going up with `..` where it has to.
   *
   * The two are resolved first, so a relative and an absolute path can still be
   * compared: both mean somewhere, and this is the way between them.
   */
  relative(from: string, to: string): string;
  /**
   * The same path with `.` and `..` worked out and the separators tidied.
   *
   * `..` past the root of an absolute path is dropped, because there is nothing
   * above it. On a relative path it is kept: it still means somewhere.
   */
  normalize(path: string): string;
  /** Everything but the last part. A path with only one part has no parent. */
  dirname(path: string): string;
  /** The last part, extension and all. */
  basename(path: string): string;
  /**
   * The last dot of the last part and what follows it, or nothing.
   *
   * A name that begins with a dot and has no other is not an extension: the
   * whole of `.gitignore` is its name.
   */
  extension(path: string): string;
  isAbsolute(path: string): boolean;
  /** The parts, in order, with the separators gone. */
  split(path: string): readonly string[];
}

/** What a spelling is built with: where it starts from. */
export interface PathsArgs {
  /** What {@link Paths.cwd} answers, and what `resolve` starts from. */
  cwd?: string;
}

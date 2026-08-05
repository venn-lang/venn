import { relative } from "node:path";

/**
 * A file path as a person reading the terminal wants it: relative to where the
 * command was invoked, with forward slashes.
 *
 * An absolute path is kept whole when the file is outside the working
 * directory, because `../../../var/tmp/x.vn` is harder to place than the path
 * itself. Windows separators are turned round so a location pasted from output
 * matches the one in an editor's title bar and in the corpus.
 *
 * @param file An absolute path, or a uri that is one.
 * @returns The path to print. Never empty: a file that is the working
 * directory itself comes back as it went in.
 */
export function shorten(file: string): string {
  const path = relative(process.cwd(), file);
  return path && !path.startsWith("..") ? path.replace(/\\/g, "/") : file;
}

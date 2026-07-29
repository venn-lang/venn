import { fsNotFound } from "./file-system.errors.js";
import type { DirEntry, FileSystem } from "./file-system.types.js";

/** The double: byte-exact, isolated per instance, no disk. */
export function createMemoryFs(): FileSystem {
  const files = new Map<string, Uint8Array>();
  return {
    async read(path) {
      const bytes = files.get(path);
      if (!bytes) throw fsNotFound({ path });
      return bytes.slice();
    },
    async write(path, bytes) {
      files.set(path, bytes.slice());
    },
    async exists(path) {
      return files.has(path);
    },
    async remove(path) {
      if (!files.delete(path)) throw fsNotFound({ path });
    },
    async removeAll(path) {
      const under = `${withoutTrailingSlashes(path)}/`;
      files.delete(path);
      for (const held of [...files.keys()]) if (held.startsWith(under)) files.delete(held);
    },
    async list(path) {
      return listUnder([...files.keys()], path);
    },
  };
}

/**
 * What a directory holds, worked out from the paths written.
 *
 * There are no directories here, only paths, so a directory is whatever a path
 * implies one to be. For everything the language does with a directory that is
 * the same answer the real file system gives, which is what lets the TCK ask
 * both the same questions.
 */
function listUnder(paths: readonly string[], directory: string): DirEntry[] {
  const prefix =
    directory === "" || directory === "." ? "" : `${withoutTrailingSlashes(directory)}/`;
  const seen = new Map<string, boolean>();
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (rest !== "") seen.set(slash < 0 ? rest : rest.slice(0, slash), slash >= 0);
  }
  return [...seen].map(([name, isDirectory]) => ({ name, directory: isDirectory }));
}

/**
 * A path with its trailing slashes removed.
 *
 * Scanned rather than matched with `/\/+$/`, which the engine retries at every
 * position when the string does not end in one: quadratic on a long path, and
 * a path is whatever it was handed.
 */
function withoutTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path.charCodeAt(end - 1) === 47) end -= 1;
  return path.slice(0, end);
}

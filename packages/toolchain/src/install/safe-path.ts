/**
 * Everything in an npm tarball sits under this, and it is not part of where the
 * file goes: `package/dist/index.js` is installed as `dist/index.js`.
 */
const ROOT = "package/";

/**
 * Where an entry from an archive may be written, relative to the destination.
 *
 * An archive is somebody else's file, and a name inside one is a claim about
 * where its content should end up. `../../.ssh/authorized_keys` is a valid tar
 * entry, and a reader that joins names onto a path without asking will write it
 * exactly where it says.
 *
 * So the answer is only given for a name that stays inside: no segment that
 * climbs, nothing anchored to a root or a drive, and nothing outside the
 * `package/` prefix every npm tarball uses.
 *
 * @param name The entry name, as the archive gave it.
 * @returns The path to write it at, relative to the version directory, or
 * nothing when the name is not one to honour.
 */
export function safePathFor(name: string): string | undefined {
  const path = name.split("\\").join("/");
  if (!path.startsWith(ROOT)) return undefined;
  const inside = path.slice(ROOT.length);
  return isContained(inside) ? inside : undefined;
}

function isContained(path: string): boolean {
  if (path === "" || path.endsWith("/")) return false;
  if (path.startsWith("/") || /^[a-z]:/i.test(path)) return false;
  return path.split("/").every((segment) => segment !== "" && segment !== ".." && segment !== ".");
}

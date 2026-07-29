import type { FileSystem } from "@venn-lang/contracts";
import type { EntryKind } from "./home.types.js";
import { versionRoot } from "./venn-home.js";

/**
 * What a version might call each entry point, in the order to try.
 *
 * More than one name because the answer changed: the published package still
 * declares `venn`, and the language separated from the orchestrator declares
 * `venn-run`. A version installed before that split has to keep working.
 */
const NAMES: Readonly<Record<EntryKind, readonly string[]>> = {
  run: ["venn-run", "venn"],
  lsp: ["venn-lsp"],
};

/**
 * The file to run for an installed version, read from what it declares.
 *
 * Taken from the `bin` field of the version's own manifest rather than assumed,
 * so a version decides where it keeps its entry points and this does not have
 * to be right about every version ever published.
 *
 * @returns The path to run, or nothing when the version is absent or offers no
 * entry point of that kind.
 */
export async function entryOf(args: {
  fs: FileSystem;
  home: string;
  version: string;
  kind: EntryKind;
}): Promise<string | undefined> {
  const root = versionRoot(args);
  const declared = await binIn(args.fs, `${root}/package.json`);
  for (const name of NAMES[args.kind]) {
    const path = declared[name];
    if (path !== undefined) return `${root}/${path.replace(/^\.\//, "")}`;
  }
  return undefined;
}

/**
 * The `bin` field, as a map. npm allows a bare string, which names the one
 * binary after the package itself.
 */
async function binIn(fs: FileSystem, path: string): Promise<Record<string, string>> {
  const manifest = await readJson(fs, path);
  const bin = manifest?.bin;
  if (typeof bin === "string") return { venn: bin };
  if (typeof bin !== "object" || bin === null) return {};
  const found: Record<string, string> = {};
  for (const [name, value] of Object.entries(bin)) {
    if (typeof value === "string") found[name] = value;
  }
  return found;
}

async function readJson(
  fs: FileSystem,
  path: string,
): Promise<Record<string, unknown> | undefined> {
  if (!(await fs.exists(path))) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(await fs.read(path))) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

import type { FileSystem } from "@venn-lang/contracts";
import { parseToml } from "@venn-lang/contracts";
import type { VersionRequest } from "./resolve.types.js";

/** A project pins its language beside the rest of what it declares. */
const MANIFEST = "venn.toml";

/** A directory that is not a project pins one without inventing a manifest. */
const VERSION_FILE = ".venn-version";

/**
 * The version pinned in a directory, if either file there pins one.
 *
 * The manifest wins. A project that declares its language in `venn.toml` has
 * said so where the rest of its decisions live, and a `.venn-version` sitting
 * next to it is either older or somebody's local experiment.
 *
 * @returns The pin, or nothing when this directory does not have one. A file
 * that cannot be read or makes no sense is treated as no pin at all: a
 * malformed manifest is the compiler's to complain about, not this.
 */
export async function pinnedIn(args: {
  fs: FileSystem;
  directory: string;
}): Promise<VersionRequest | undefined> {
  return (await fromManifest(args)) ?? (await fromFile(args));
}

async function fromManifest(args: {
  fs: FileSystem;
  directory: string;
}): Promise<VersionRequest | undefined> {
  const path = `${args.directory}/${MANIFEST}`;
  const content = await readText(args.fs, path);
  if (content === undefined) return undefined;
  const version = declaredIn(content);
  return version === undefined ? undefined : { range: version, source: "manifest", from: path };
}

/** `[package] venn = "0.2.0"`, beside the name and the version of the project. */
function declaredIn(content: string): string | undefined {
  const table = parseToml(content).package;
  if (typeof table !== "object" || table === null) return undefined;
  const declared = (table as Record<string, unknown>).venn;
  return typeof declared === "string" && declared.trim() !== "" ? declared.trim() : undefined;
}

async function fromFile(args: {
  fs: FileSystem;
  directory: string;
}): Promise<VersionRequest | undefined> {
  const path = `${args.directory}/${VERSION_FILE}`;
  const content = await readText(args.fs, path);
  if (content === undefined) return undefined;
  const version = firstLine(content);
  return version === "" ? undefined : { range: version, source: "file", from: path };
}

/** The rest of the file is room for a comment about why the version is pinned. */
function firstLine(content: string): string {
  return (content.split("\n")[0] ?? "").trim();
}

async function readText(fs: FileSystem, path: string): Promise<string | undefined> {
  if (!(await fs.exists(path))) return undefined;
  try {
    return new TextDecoder().decode(await fs.read(path));
  } catch {
    return undefined;
  }
}

import type { FileSystem } from "@venn-lang/contracts";
import { join } from "../paths/index.js";
import { modulesDir } from "../target/index.js";
import { hashPackage } from "./hash-package.js";
import type { LockedPackage } from "./lockfile.types.js";

/**
 * Every package installed, read from `target/node_modules`.
 *
 * The installed tree is the strongest statement there is about what a project
 * resolved to: it is what will actually be imported, whichever tool put it
 * there and whatever that tool's own lock says. One walk, the same for every
 * manager. A scope is a directory of packages rather than a package, so
 * `@types/node` is found one level further down.
 *
 * @param args.root The project root, not the modules directory.
 * @returns Every package with its version and content hash, in name order.
 * Dot-directories and anything without a readable `package.json` are skipped,
 * because a directory that is not a package is not a package.
 */
export async function readInstalled(args: {
  fs: FileSystem;
  root: string;
}): Promise<LockedPackage[]> {
  const modules = modulesDir(args.root);
  const found: LockedPackage[] = [];
  for (const entry of await args.fs.list(modules)) {
    if (!entry.directory || entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) found.push(...(await scoped(args.fs, modules, entry.name)));
    else pushIf(found, await readPackage(args.fs, join(modules, entry.name)));
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

async function scoped(fs: FileSystem, modules: string, scope: string): Promise<LockedPackage[]> {
  const found: LockedPackage[] = [];
  for (const entry of await fs.list(join(modules, scope))) {
    if (entry.directory) pushIf(found, await readPackage(fs, join(modules, scope, entry.name)));
  }
  return found;
}

function pushIf(into: LockedPackage[], one: LockedPackage | undefined): void {
  if (one) into.push(one);
}

async function readPackage(fs: FileSystem, dir: string): Promise<LockedPackage | undefined> {
  const bytes = await fs.read(join(dir, "package.json")).catch(() => undefined);
  if (!bytes) return undefined;
  const data = parse(new TextDecoder().decode(bytes));
  if (typeof data?.name !== "string" || typeof data.version !== "string") return undefined;
  return {
    name: data.name,
    version: data.version,
    integrity: await hashPackage({ fs, dir }),
    ...deps(data.dependencies),
  };
}

function deps(value: unknown): { dependencies?: Record<string, string> } {
  if (typeof value !== "object" || value === null) return {};
  const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
  return entries.length > 0 ? { dependencies: Object.fromEntries(entries) } : {};
}

function parse(text: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

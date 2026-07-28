import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TypeSpec } from "@venn/types";

/** Where derived types are kept: derived, so under `target/` with the rest. */
export function typesDir(root: string): string {
  return join(root, "target", "types");
}

/**
 * Derive what each installed package publishes, and keep it.
 *
 * Written once, at install, rather than worked out on every check: reading a
 * package's declarations through the compiler takes about a second for a large
 * one, and the answer only changes when what is installed does.
 */
export async function deriveTypes(args: {
  root: string;
  packages: readonly string[];
}): Promise<{ name: string; total: number; typed: number }[]> {
  // Loaded when it is needed and not before: it pulls in the TypeScript
  // compiler, which is ten megabytes that `venn run` should never pay for.
  const { readPackageTypes } = await import("@venn/dts");
  const from = join(args.root, "target", "package.json");
  const dir = typesDir(args.root);
  await mkdir(dir, { recursive: true });
  const found: { name: string; total: number; typed: number }[] = [];
  for (const name of args.packages) {
    const types = readPackageTypes({ package: name, from });
    await writeFile(fileFor(dir, name), `${JSON.stringify(types, null, 2)}\n`, "utf8");
    found.push({
      name,
      total: types.covered.total,
      typed: types.covered.total - types.covered.dynamic,
    });
  }
  return found;
}

/** What was derived earlier, by the specifier each was derived for. */
export async function loadDerivedTypes(args: {
  root: string;
  packages: readonly string[];
}): Promise<Map<string, Record<string, TypeSpec>>> {
  const dir = typesDir(args.root);
  const out = new Map<string, Record<string, TypeSpec>>();
  for (const name of args.packages) {
    const text = await readFile(fileFor(dir, name), "utf8").catch(() => undefined);
    const parsed = text && parse(text);
    if (parsed) out.set(name, parsed.exports);
  }
  return out;
}

/** A scope holds a slash and a file name cannot, so `@types/node` becomes `@types__node`. */
function fileFor(dir: string, name: string): string {
  return join(dir, `${name.replace("/", "__")}.json`);
}

function parse(text: string): { exports: Record<string, TypeSpec> } | undefined {
  try {
    return JSON.parse(text) as { exports: Record<string, TypeSpec> };
  } catch {
    return undefined;
  }
}

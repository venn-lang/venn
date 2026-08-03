import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Document, isPackageSpecifier, isValueImport } from "@venn-lang/core";
import { PROJECT_CODES } from "@venn-lang/project";
import type { TypeSpec } from "@venn-lang/types";

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
  const readPackageTypes = await theReader();
  if (!readPackageTypes) return [];
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

type ReadPackageTypes = typeof import("@venn-lang/dts")["readPackageTypes"];

/**
 * The deriver, or nothing when this build cannot reach it.
 *
 * Loaded when it is needed and not before: it pulls in the TypeScript compiler,
 * which is ten megabytes that `venn run` should never pay for. It used to be
 * outside the tarball as well as outside the engine, so `venn add` ended in a
 * Node stack trace after the manifest was edited, the packages installed and
 * the lock written. Types not derived is a smaller thing than that, and it is
 * said as one: `venn check` reads what is in `target/types/` and treats an
 * imported name it has nothing for as `dynamic`, which is the truth about it.
 */
async function theReader(): Promise<ReadPackageTypes | undefined> {
  try {
    return (await import("@venn-lang/dts")).readPackageTypes;
  } catch {
    process.stderr.write(
      `${PROJECT_CODES.VN2108_NO_TYPE_DERIVATION} · types not derived: this build cannot load the TypeScript compiler.\n`,
    );
    return undefined;
  }
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

/**
 * The types the packages this document imports published, from `target/types/`.
 *
 * One definition, because `venn check` read them and `venn run` did not, so the
 * two commands type-checked different worlds and disagreed about a name that
 * came from a package. A caller with no project root reads none, which is the
 * honest answer rather than a decision not to look.
 *
 * @param args The document whose imports decide what to load, and the project root.
 * @returns What each imported package publishes, empty when there is nothing to read.
 */
export async function packageTypesFor(args: {
  document: Document;
  root?: string;
}): Promise<Map<string, Record<string, TypeSpec>>> {
  if (!args.root) return new Map();
  const wanted = args.document.imports
    .filter(isValueImport)
    .map((decl) => decl.path)
    .filter(isPackageSpecifier);
  return wanted.length > 0 ? loadDerivedTypes({ root: args.root, packages: wanted }) : new Map();
}

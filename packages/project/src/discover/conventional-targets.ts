import { BIN_DIR, type BuildTarget, type FileSystem, LIB_ROOT, MAIN_ROOT } from "@venn/contracts";
import { join } from "../paths/index.js";

/**
 * What a package builds when its manifest does not say.
 *
 * `src/lib.vn` is a library, `src/main.vn` is a program, and each file in
 * `src/bin/` is another program. A package that builds the obvious thing should
 * not have to write it down. A declared target always wins, matched by kind and
 * name, so writing `[lib]` with a different `path` moves the library rather
 * than adding a second one.
 *
 * @param args.declared What the manifest spelled out.
 * @param args.packageName Names the `lib` and the `src/main.vn` program.
 * @returns The declared targets, followed by every convention found on disk.
 */
export async function conventionalTargets(args: {
  fs: FileSystem;
  dir: string;
  declared: readonly BuildTarget[];
  packageName: string;
}): Promise<BuildTarget[]> {
  const found = [...args.declared];
  const add = async (target: BuildTarget): Promise<void> => {
    if (found.some((one) => one.kind === target.kind && one.name === target.name)) return;
    if (await args.fs.exists(join(args.dir, target.path))) found.push(target);
  };
  await add({ kind: "lib", name: args.packageName, path: LIB_ROOT });
  await add({ kind: "bin", name: args.packageName, path: MAIN_ROOT });
  for (const name of await binNames(args.fs, args.dir)) {
    await add({ kind: "bin", name, path: `${BIN_DIR}/${name}.vn` });
  }
  return found;
}

/** Each `.vn` in `src/bin/` is a program named after the file. */
async function binNames(fs: FileSystem, dir: string): Promise<string[]> {
  const entries = await fs.list(join(dir, BIN_DIR));
  return entries
    .filter((entry) => !entry.directory && entry.name.endsWith(".vn"))
    .map((entry) => entry.name.slice(0, -".vn".length))
    .sort();
}

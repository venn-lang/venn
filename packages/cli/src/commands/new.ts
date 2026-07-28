import { resolve } from "node:path";
import { createNodeFs } from "@venn-lang/contracts/node";
import {
  MANIFEST_FILE,
  normalise,
  type ScaffoldFile,
  type ScaffoldKind,
  scaffold,
} from "@venn-lang/project";
import { insideWorkspace } from "./inside-workspace.js";

export interface NewArgs {
  /** Where the project goes. For `init` this is the directory it is run in. */
  dir: string;
  name: string;
  kind: ScaffoldKind;
  /** Print what would be written and write nothing. */
  dryRun?: boolean;
}

/**
 * `venn new <name>` and `venn init`: start a project.
 *
 * Refuses to write over a manifest that is already there. Starting a project on
 * top of one that exists is never what was meant, and the cost of being wrong
 * about that is somebody's work.
 */
export async function newCommand(args: NewArgs): Promise<number> {
  // Rooted at the directory being created, so every path below is relative to
  // it. The file system joins its root onto what it is given, so an absolute
  // path would write one path inside another.
  const dir = normalise(resolve(args.dir));
  const fs = createNodeFs({ root: dir });
  if (await fs.exists(MANIFEST_FILE)) {
    process.stderr.write(`VN2102 · there is already a ${MANIFEST_FILE} in ${dir}\n`);
    return 1;
  }
  const files = scaffold({
    kind: args.kind,
    name: args.name,
    insideWorkspace: args.kind === "workspace" ? false : await insideWorkspace(dir),
  });
  if (args.dryRun) return describe(files, dir);
  const encoder = new TextEncoder();
  for (const file of files) await fs.write(file.path, encoder.encode(file.content));
  return announce(args, dir, files);
}

function describe(files: readonly ScaffoldFile[], dir: string): number {
  process.stdout.write(`would write into ${dir}:\n`);
  for (const file of files) process.stdout.write(`  ${file.path}\n`);
  return 0;
}

const NEXT: Record<ScaffoldKind, string> = {
  lib: "write src/lib.vn, and `pub` what others should reach",
  bin: "venn run src/main.vn",
  workspace: "venn new packages/api --bin",
};

function announce(args: NewArgs, dir: string, files: readonly ScaffoldFile[]): number {
  process.stdout.write(`created ${args.kind} ${args.name} in ${dir}\n`);
  for (const file of files) process.stdout.write(`  ${file.path}\n`);
  process.stdout.write(`\nnext:  ${NEXT[args.kind]}\n`);
  return 0;
}

import { readFile, writeFile } from "node:fs/promises";
import { addDependency, removeDependency } from "@venn-lang/contracts";
import { createNodeFs, createNodeSpawn } from "@venn-lang/contracts/node";
import {
  describeDrift,
  isSafeSpec,
  join,
  MANIFEST_FILE,
  managerCommand,
  type Package,
  PROJECT_CODES,
  type Project,
  type ProxiedVerb,
  packageJsonFor,
  readLockfile,
  targetDir,
  verifyLock,
  writeLockfile,
} from "@venn-lang/project";
import { selectPackages, unknownPackage } from "../project/index.js";
import { deriveTypes } from "../run/package-types.js";

export interface DepsArgs {
  verb: ProxiedVerb;
  /** `--frozen`: install, then refuse anything the lock did not record. */
  frozen?: boolean;
  /** Specs such as `zod`, `zod@^4` or `@types/node`, passed through untouched. */
  packages: readonly string[];
  dev?: boolean;
  packageName?: string;
}

/**
 * `venn add · remove · update · install`: the four verbs, run underneath by
 * whichever package manager `[tooling]` names.
 *
 * The manifest is edited first and the manager is run second, against a
 * `package.json` generated into `target/`. That ordering is what makes
 * `venn.toml` the source rather than a copy: whatever the tool decides, the
 * file a person reads was written from what they asked for.
 */
export async function depsCommand(args: DepsArgs): Promise<number> {
  const selection = await selectPackages({ from: process.cwd(), packageName: args.packageName });
  if (!selection) {
    process.stderr.write(
      `${PROJECT_CODES.VN2101_NO_PROJECT} · no venn.toml here, or in any folder above it.\n`,
    );
    return 1;
  }
  if (args.packageName && selection.packages.length === 0) {
    process.stderr.write(unknownPackage(selection.project, args.packageName));
    return 1;
  }
  const unsafe = args.packages.filter((spec) => !isSafeSpec(spec));
  if (unsafe.length > 0) {
    process.stderr.write(
      `${PROJECT_CODES.VN2105_NOT_A_PACKAGE_NAME} · not a package name: ${unsafe.join(", ")}\n`,
    );
    return 1;
  }
  const target = selection.packages[0] ?? holder(selection.project);
  if (!target) {
    process.stderr.write(
      `${PROJECT_CODES.VN2104_NOTHING_TO_ADD_TO} · no package here to add a dependency to.\n`,
    );
    return 1;
  }
  await editManifest({ ...args, dir: target.dir });
  // Read again: the manifest just changed, and the project in hand was read
  // before it did, so installing from that one would install what the file
  // asked for before the command ran.
  const after = await selectPackages({ from: process.cwd() });
  if (!after) return 1;
  const code = await install(after.project, args.frozen === true);
  if (code !== 0) return code;
  await pinResolved({ ...args, dir: target.dir, root: after.project.root });
  return 0;
}

/**
 * Write back the version that was actually resolved.
 *
 * `venn add zod` asks for whatever is newest, and a manifest left reading
 * `zod = "latest"` pins nothing a reader can act on. `^` because asking for the
 * newest means this version and the compatible ones after it.
 */
async function pinResolved(args: DepsArgs & { dir: string; root: string }): Promise<void> {
  const asked = args.packages.filter((spec) => spec.indexOf("@", 1) < 0);
  if (args.verb !== "add" || asked.length === 0) return;
  const lock = await readLockfile({ fs: createNodeFs(), root: args.root });
  const path = join(args.dir, MANIFEST_FILE);
  let text = await readFile(path, "utf8");
  for (const name of asked) {
    const found = lock?.packages.find((one) => one.name === name);
    if (found) {
      text = addDependency({
        text,
        name,
        version: `^${found.version}`,
        table: args.dev ? "dev-dependencies" : undefined,
      });
    }
  }
  await writeFile(path, text, "utf8");
}

/**
 * What is installed, against what the lock recorded.
 *
 * A lock nobody checks is decoration. Verifying it turns "the registry answered
 * differently today" into something a build refuses to start with, rather than
 * something found in production.
 */
async function checkAgainstLock(root: string): Promise<number> {
  const fs = createNodeFs();
  const lock = await readLockfile({ fs, root });
  if (!lock) {
    process.stderr.write(
      `${PROJECT_CODES.VN2106_NO_LOCK} · --frozen, but there is no venn.lock to check against.\n`,
    );
    return 1;
  }
  const drift = await verifyLock({ fs, root, lock });
  if (drift.length === 0) return 0;
  const lines = describeDrift(drift);
  process.stderr.write(
    `${PROJECT_CODES.VN2107_LOCK_DISAGREES} · what is installed is not what the lock says.\n${lines}\n`,
  );
  return 1;
}

/** A workspace root that is not itself a package cannot hold a dependency. */
function holder(project: Project): Package | undefined {
  return project.packages.find((one) => one.dir === project.root);
}

/**
 * The manifest, rewritten where it stands.
 *
 * `update` and `install` change nothing here: they are about what is on disk,
 * not about what was asked for.
 */
async function editManifest(args: DepsArgs & { dir: string }): Promise<void> {
  if (args.verb === "update" || args.verb === "install") return;
  const path = join(args.dir, MANIFEST_FILE);
  let text = await readFile(path, "utf8");
  const table = args.dev ? "dev-dependencies" : undefined;
  for (const spec of args.packages) {
    const { name, version } = split(spec);
    text =
      args.verb === "add"
        ? addDependency({ text, name, version, table })
        : removeDependency({ text, name, table });
  }
  await writeFile(path, text, "utf8");
}

/**
 * `zod@^4`: the name, and what was asked for.
 *
 * A scope starts with `@` and is not a version, so the separator is looked for
 * after the first character.
 */
function split(spec: string): { name: string; version: string } {
  const at = spec.indexOf("@", 1);
  if (at < 0) return { name: spec, version: "latest" };
  return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

/**
 * Generate the `package.json` the manager reads, run it there, and record what
 * came out. The manager writes `node_modules` beside the file it was pointed
 * at, so pointing it at `target/` puts them where Node will look for them.
 */
async function install(project: Project, frozen: boolean): Promise<number> {
  const fs = createNodeFs();
  const dir = targetDir(project.root);
  const members = project.packages.map((one) => one.manifest);
  const json = packageJsonFor({ manifest: project.rootManifest, members });
  await fs.write(join(dir, "package.json"), new TextEncoder().encode(json));
  const code = await run({ manager: project.rootManifest.tooling.manager, dir });
  if (code !== 0) return code;
  // Under `--frozen` the lock is the input, not the output: writing it first
  // and then checking against what was just written is a check that cannot fail.
  if (frozen) return checkAgainstLock(project.root);
  const lock = await writeLockfile({
    fs,
    root: project.root,
    manager: project.rootManifest.tooling.manager,
  });
  process.stdout.write(`locked ${lock.packages.length} package(s)\n`);
  await reportTypes(project.root, asked(project));
  return 0;
}

/** The packages the project asked for by name, not everything that came with them. */
function asked(project: Project): string[] {
  const all = project.packages.flatMap((one) => [
    ...one.manifest.dependencies,
    ...one.manifest.devDependencies,
  ]);
  return [...new Set(all.filter((dep) => dep.path === undefined).map((dep) => dep.name))];
}

/**
 * Derive the types each package publishes, and say how much came across.
 *
 * A measured number rather than a claim: "94% of exports typed" can be checked
 * and driven up, where "fully compatible" would be false for any package built
 * on conditional types.
 */
async function reportTypes(root: string, packages: readonly string[]): Promise<void> {
  if (packages.length === 0) return;
  const found = await deriveTypes({ root, packages });
  for (const one of found) {
    const pct = one.total === 0 ? 0 : Math.round((one.typed / one.total) * 100);
    const detail = one.total === 0 ? "no types published" : `${pct}% of ${one.total} exports typed`;
    process.stdout.write(`  ${one.name}: ${detail}
`);
  }
}

async function run(args: { manager: string; dir: string }): Promise<number> {
  const spec = managerCommand({
    manager: args.manager as never,
    verb: "install",
    platform: process.platform,
  });
  const handle = createNodeSpawn().spawn({
    command: spec.command,
    args: spec.args,
    cwd: args.dir,
    shell: spec.shell,
    onOutput: (chunk) => process.stdout.write(chunk),
  });
  const result = await handle.wait();
  if (result.code !== 0) process.stderr.write(`\n${args.manager} exited with ${result.code}\n`);
  return result.code;
}

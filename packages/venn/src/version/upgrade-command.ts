import { defaultVersion, resolveVersion } from "@venn-lang/toolchain";
import type { Surroundings } from "../execute.js";
import { ensureInstalled } from "./ensure-installed.js";
import { writeDefault } from "./write-default.js";

/**
 * `venn upgrade`: fetch the newest language and make it the default.
 *
 * The orchestrator answers this itself. The old one lived in the language and
 * ran `npm install -g`, which after the split fetched a second compiler to a
 * place nothing looks in: the upgrade appeared to work and changed nothing.
 *
 * A directory that pins a version keeps it. Upgrading the machine is not a
 * reason to move a project that other people also work on, and `venn version
 * use` is how a project moves.
 *
 * @param args Everything after the binary name, and the surroundings.
 * @returns The exit code, or nothing when this is not `upgrade` and should be
 * handed over like anything else.
 */
export async function upgradeCommand(args: {
  argv: readonly string[];
  where: Surroundings;
}): Promise<number | undefined> {
  if (args.argv[0] !== "upgrade") return undefined;
  const { where } = args;
  const version = await ensureInstalled({ where, args: [] }, "latest");
  if (version === undefined) return 1;

  await writeDefault({ where, version });
  where.say(`Now using ${version} by default`);
  await notePin(where);
  return 0;
}

/**
 * Said only when this directory pins something, and naming the file that does,
 * because someone who upgrades and then watches the old version run needs the
 * reason in front of them rather than in the documentation.
 */
async function notePin(where: Surroundings): Promise<void> {
  const request = await resolveVersion({
    fs: where.fs,
    directory: where.cwd,
    defaultVersion: await defaultVersion({ fs: where.fs, home: where.home }),
  });
  if (request.from === undefined) return;
  where.say(`This directory still uses ${request.range}, asked for by ${request.from}`);
}

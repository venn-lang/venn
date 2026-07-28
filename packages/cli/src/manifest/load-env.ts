// biome-ignore-all lint/suspicious/noTemplateCurlyInString: ${name} is a placeholder in a dotenv path, not a JavaScript template.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { dotenvFiles, type Manifest, parseDotenv } from "@venn-lang/contracts";

export interface EnvArgs {
  manifest: Manifest | undefined;
  /** The selected environment: `--env staging`, or `local`. */
  name: string;
  /** Any file the manifest points at is resolved from here. */
  dir: string;
  /** The process environment. Injected so a test can hand over its own. */
  processEnv?: Record<string, string | undefined>;
}

/**
 * Every variable a run can see, lowest precedence first:
 *
 *   1. `[env.<name>]` in `venn.toml`, the documented default, committed.
 *   2. the dotenv files, in the order they are listed.
 *   3. the real environment the process was started with.
 *
 * The real environment wins because that is how CI passes a token in, and a
 * value set on the command line should never lose to a file in the repository.
 */
export async function loadEnv(args: EnvArgs): Promise<Record<string, unknown>> {
  const declared = { ...(args.manifest?.env[args.name] ?? {}), ...(await readFiles(args)) };
  const real = overrides(declared, args.processEnv ?? process.env);
  return { ...declared, ...real, name: args.name };
}

/**
 * The real environment overrides what was declared. It does not add to it.
 *
 * A shell holds hundreds of entries; letting them all become `env.*` would put
 * `PATH` and `TEMP` in the editor's completion and let a typo silently read
 * something from the machine. Declaring a name, in `venn.toml` or a dotenv file
 * and with any value, is what says "this program reads this". A value that
 * exists only in CI and is never declared belongs to `secrets.*`, which reads
 * the environment directly and redacts what it returns.
 */
function overrides(
  declared: Record<string, string>,
  source: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(declared)) {
    const value = source[name];
    if (value !== undefined) out[name] = value;
  }
  return out;
}

async function readFiles(args: EnvArgs): Promise<Record<string, string>> {
  const names = dotenvFiles({ configured: args.manifest?.envFiles, name: args.name });
  const out: Record<string, string> = {};
  for (const each of names) Object.assign(out, await readOne(resolve(args.dir, each)));
  return out;
}

/** A file that is not there is not a problem: most projects have none of them. */
async function readOne(path: string): Promise<Record<string, string>> {
  const content = await readFile(path, "utf8").catch(() => undefined);
  return content === undefined ? {} : parseDotenv(content);
}

/** Where dotenv files are looked for: the folder holding the flow. */
export function envDirOf(sourceUri: string): string {
  return dirname(sourceUri);
}

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { declaredEnvNames, dotenvFiles, type Manifest, parseDotenv } from "@venn-lang/contracts";
import type { LoadedManifest } from "./load-manifest.js";

/**
 * The variables this project declares, as every command has to see them.
 *
 * Read once and handed to the front end, so `venn check`, `venn run` and `venn
 * test` cannot disagree about it. The dotenv files are read here because they
 * are part of the declaration: keeping a token out of the repository is what
 * `.env` is for, and a check that fails on one is a check the project cannot
 * pass.
 *
 * @param found The manifest governing the file, and where it lives. Undefined
 * where the file belongs to no project.
 * @returns Every declared name, or `undefined` where there is no manifest to
 * compare against.
 */
export async function declaredEnv(
  found: LoadedManifest | undefined,
): Promise<readonly string[] | undefined> {
  if (!found) return undefined;
  const sections = found.manifest.env;
  return declaredEnvNames({ sections, dotenv: await dotenvNames(found) });
}

/**
 * The names the dotenv files hold, across every environment.
 *
 * Every environment, because the declared set is a union: nothing here selects
 * one, and `.env.staging` declares a variable whether or not `--env staging`
 * was written.
 */
async function dotenvNames(found: LoadedManifest): Promise<Set<string>> {
  const names = new Set<string>();
  for (const environment of environments(found.manifest)) {
    for (const file of dotenvFiles({ configured: found.manifest.envFiles, name: environment })) {
      for (const key of await keysIn(resolve(found.dir, file))) names.add(key);
    }
  }
  return names;
}

/** Every environment named anywhere, and `local`, which exists without being written. */
function environments(manifest: Manifest): Set<string> {
  return new Set([...Object.keys(manifest.env), "local"]);
}

/** A file that is not there is not a problem: most projects have none of them. */
async function keysIn(path: string): Promise<string[]> {
  const content = await readFile(path, "utf8").catch(() => undefined);
  return content === undefined ? [] : Object.keys(parseDotenv(content));
}

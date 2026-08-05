import { readFile, writeFile } from "node:fs/promises";
import { formatOptionsFrom, formatText } from "@venn-lang/core";
import { loadManifest } from "../manifest/index.js";
import { shorten } from "../paths/index.js";
import { dim, green, yellow } from "../reporters/colors.js";
import { everySourceUnder } from "../run/collect-files.js";

/** Everything `venn fmt` accepts. */
export interface FmtOptions {
  paths: readonly string[];
  check?: boolean;
}

/**
 * `venn fmt <file|folder>`: format in place, or with `--check` report what would
 * change and fail, which is what CI wants.
 *
 * @returns 0 when nothing needs changing, 1 under `--check` when a file would
 * change or when the paths hold no `.vn` file.
 */
export async function fmtCommand(options: FmtOptions): Promise<number> {
  const files = await everySourceUnder(options.paths);
  if (files.length === 0) {
    process.stderr.write(`No .vn files found at ${options.paths.join(", ")}\n`);
    return 1;
  }
  const changed: string[] = [];
  for (const file of files) {
    if (await reformat(file, options.check === true)) changed.push(file);
  }
  return report(changed, files.length, options.check === true);
}

async function reformat(file: string, check: boolean): Promise<boolean> {
  const source = await readFile(file, "utf8");
  const found = await loadManifest(file);
  const formatted = formatText(source, formatOptionsFrom(found?.manifest.format));
  if (formatted === source) return false;
  if (!check) await writeFile(file, formatted, "utf8");
  return true;
}

function report(changed: readonly string[], total: number, check: boolean): number {
  for (const file of changed) {
    process.stdout.write(`  ${check ? yellow("~") : green("✓")} ${shorten(file)}\n`);
  }
  const verb = check ? "would change" : "formatted";
  process.stdout.write(`\n ${dim(verb)}  ${changed.length}/${total}\n`);
  return check && changed.length > 0 ? 1 : 0;
}

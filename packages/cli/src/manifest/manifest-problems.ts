import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type StrayKey, strayManifestKeys } from "@venn-lang/contracts";
import { buildProblem, type Problem } from "@venn-lang/core";
import { PROJECT_CODES } from "@venn-lang/project";

/**
 * What a project's `venn.toml` says that nothing reads.
 *
 * Reported where every other problem is reported, because a manifest is exactly
 * where silent acceptance hurts: an unknown table changed nothing and said
 * nothing, so `[runner] workers = 4` looked like a setting for the life of the
 * project.
 *
 * @param dirs The project directories to read, each holding one `venn.toml`.
 * @returns One problem per stray table or key. Empty when a manifest cannot be
 * read at all, which is what living outside a project looks like.
 */
export async function manifestProblems(dirs: Iterable<string>): Promise<Problem[]> {
  const found: Problem[] = [];
  for (const dir of new Set(dirs)) found.push(...(await strayIn(join(dir, "venn.toml"))));
  return found;
}

async function strayIn(uri: string): Promise<Problem[]> {
  const content = await readFile(uri, "utf8").catch(() => undefined);
  if (content === undefined) return [];
  return strayManifestKeys(content).map((stray) => problemOf(stray, uri));
}

function problemOf(stray: StrayKey, uri: string): Problem {
  return {
    ...buildProblem({
      spec: { code: PROJECT_CODES.VN2109_UNKNOWN_MANIFEST_KEY, severity: "error" },
      span: { uri, offset: 0, length: 0, line: stray.line, column: 1 },
      title: `Nothing reads "${stray.path}" in venn.toml.`,
    }),
    help: "Take it out, or check the spelling against section 11 of the language guide.",
  };
}

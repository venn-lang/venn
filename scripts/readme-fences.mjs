/**
 * The Venn blocks in the package READMEs, found by their fence.
 *
 * The READMEs tag Venn as `ruby`, which is what gives the highlighter
 * something close enough to read; the specification tags it `venn`. Both are
 * treated as Venn here, and a block tagged anything else is prose about
 * another language and is left alone.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PACKAGES, relative } from "./repo-sources.mjs";

const VENN = new Set(["ruby", "venn", "flow"]);

/** Every fenced block in one document, with the line its fence opened on. */
export function fencesIn(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const found = [];
  let open;
  for (const [at, line] of lines.entries()) {
    const fence = /^```(\w*)\s*$/.exec(line);
    if (!fence) continue;
    if (open)
      found.push({
        tag: open.tag,
        line: open.at + 1,
        body: lines.slice(open.at + 1, at).join("\n"),
      });
    open = fence[1] === "" && open ? undefined : { tag: fence[1], at };
  }
  return found;
}

/** Every package README, by the path a person would open. */
export async function readmes() {
  const entries = await readdir(PACKAGES, { withFileTypes: true });
  const found = [];
  for (const entry of entries.filter((one) => one.isDirectory())) {
    const path = join(PACKAGES, entry.name, "README.md");
    const text = await readFile(path, "utf8").catch(() => undefined);
    if (text !== undefined) found.push({ folder: entry.name, path: relative(path), text });
  }
  if (found.length === 0) throw new Error("no package README read");
  return found;
}

/** Every Venn block in every package README, ready to be handed to the checker. */
export async function everyBlock() {
  const found = [];
  for (const { folder, path, text } of await readmes()) {
    for (const fence of fencesIn(text)) {
      if (VENN.has(fence.tag))
        found.push({ folder, readme: path, line: fence.line, body: fence.body });
    }
  }
  return found;
}

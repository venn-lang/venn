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

/**
 * The opt-out, written above the fence so a reader never sees it.
 *
 * `<!-- venn-check: a plugin that does not exist -->`. A block that is a
 * catalogue of members, an illustration of a diagnostic, or a call against a
 * package nobody publishes is not Venn anybody can run, and the reason is
 * required so the marker cannot be used to make a refusal quiet.
 */
const OPT_OUT = /^<!--\s*venn-check:\s*(\S.*?)\s*-->$/;

/** Why this fence is not checked, when the line above it says. */
function excused(lines, at) {
  for (let above = at - 1; above >= 0; above -= 1) {
    const line = (lines[above] ?? "").trim();
    if (line === "") continue;
    return OPT_OUT.exec(line)?.[1];
  }
  return undefined;
}

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
        excused: open.excused,
      });
    open = fence[1] === "" && open ? undefined : { tag: fence[1], at, excused: excused(lines, at) };
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

/**
 * Every Venn block in every package README, ready to be handed to the checker.
 *
 * A block the document excused is left out entirely rather than counted clean:
 * it was never a claim about what the checker accepts, so counting it either
 * way would say something the block does not.
 */
export async function everyBlock() {
  const found = [];
  for (const { folder, path, text } of await readmes()) {
    for (const fence of fencesIn(text)) {
      if (VENN.has(fence.tag) && fence.excused === undefined)
        found.push({ folder, readme: path, line: fence.line, body: fence.body });
    }
  }
  return found;
}

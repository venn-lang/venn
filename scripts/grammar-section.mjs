/**
 * §21 of the specification, from the grammar itself.
 *
 * The section says "this is the whole file" and listed twenty-seven of the
 * seventy-six rules, three of which no longer existed. A skeleton kept by hand
 * drifts, and a specification that drifts is worse than none: it is read as
 * authority.
 *
 * `node scripts/grammar-section.mjs --write` rewrites the block. Without the
 * flag it prints what the block should be, which is what the test compares
 * against.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
export const GRAMMAR = join(ROOT, "packages", "core", "src", "grammar", "venn.langium");
export const SPEC = join(ROOT, "docs", "venn-language.md");

/** Where the block lives, found by its fence rather than by a line number. */
const OPEN = "```langium";
const CLOSE = "```";

/**
 * The grammar without its prose.
 *
 * The comments in `venn.langium` explain why each rule is shaped as it is, at
 * length, and that argument belongs beside the rule and not in a specification
 * appendix. What is left is every rule, in order, which is what the section
 * claims to be.
 */
export async function grammarBlock() {
  const text = await readFile(GRAMMAR, "utf8");
  const kept = [];
  let blank = false;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*\/\//.test(line)) continue;
    if (line.trim() === "") {
      // One blank line between rules, never two, since the comments that used
      // to separate them are gone.
      if (!blank && kept.length > 0) kept.push("");
      blank = true;
      continue;
    }
    blank = false;
    kept.push(line.trimEnd());
  }
  return kept.join("\n").trim();
}

/** The specification, with the block replaced by what the grammar says. */
export function withBlock(spec, block) {
  const from = spec.indexOf(OPEN);
  if (from === -1) throw new Error("the specification has no ```langium block");
  const to = spec.indexOf(`\n${CLOSE}`, from + OPEN.length);
  if (to === -1) throw new Error("the ```langium block is not closed");
  return `${spec.slice(0, from)}${OPEN}\n${block}\n${spec.slice(to + 1)}`;
}

/** What the block currently holds, for the test to compare. */
export function blockIn(spec) {
  const from = spec.indexOf(OPEN);
  const to = spec.indexOf(`\n${CLOSE}`, from + OPEN.length);
  return spec.slice(from + OPEN.length, to).trim();
}

if (process.argv[1]?.endsWith("grammar-section.mjs")) {
  const block = await grammarBlock();
  if (process.argv.includes("--write")) {
    await writeFile(SPEC, withBlock(await readFile(SPEC, "utf8"), block), "utf8");
    process.stdout.write(`wrote ${block.split("\n").length} lines into §21\n`);
  } else {
    process.stdout.write(`${block}\n`);
  }
}

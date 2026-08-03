/**
 * The charter's counted rules, frozen at what the tree holds today.
 *
 * Five rules are too far in debt to turn red now: eight files over three
 * hundred lines, a hundred and eighty-one functions over fifteen, thirty-four
 * signatures over three arguments, a hundred and fifty-one exported types
 * outside a `*.types.ts`, and a hundred and seventy-three imports reaching past
 * a barrel. Splitting a six-hundred-line typechecker inside the pull request
 * that adds ten guards is the reformat nobody can review.
 *
 * So this counts them per file and writes the answer down, and the guard beside
 * it only ever lets a number shrink. A file that is not in the list may not
 * appear, and a file in it may not grow.
 *
 * `node scripts/charter.mjs --write` rewrites the baseline. Without the flag it
 * prints what changed against the one on disk, which is what the test compares.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  longFunctions,
  MOST_LINES_IN_A_FILE,
  overloadedSignatures,
  parsed,
  typesOutsideATypesFile,
} from "./charter-rules.mjs";
import { pastABarrel } from "./past-a-barrel.mjs";
import { everySource, ROOT, relative, slashed } from "./repo-sources.mjs";

export const BASELINE = join(ROOT, "scripts", "charter-baseline.json");

/**
 * The Langium output, which is a grammar compiled rather than a file written.
 * `grammar.ts` alone is seven thousand lines and answers to nobody's charter.
 */
const GENERATED = "core/src/generated/";

/** Each rule, by the shortest thing a person could call it while fixing one. */
export const RULES = {
  "over 300 lines": (file, text) => tally(text.split("\n").length, MOST_LINES_IN_A_FILE),
  "functions over 15 lines": (file) => tally(longFunctions(file).length, 0),
  "types outside a .types.ts": (file) => tally(typesOutsideATypesFile(file), 0),
  "more than 3 arguments": (file) => list(overloadedSignatures(file)),
};

const tally = (count, floor) => (count > floor ? count : undefined);
const list = (names) => (names.length > 0 ? names : undefined);

/** What every rule counts, per file, with the clean files left out. */
export async function survey() {
  const source = await everySource();
  const found = Object.fromEntries(Object.keys(RULES).map((rule) => [rule, {}]));
  for (const [path, text] of source) {
    if (relative(path).includes(GENERATED)) continue;
    const file = parsed(path, text);
    for (const [rule, measure] of Object.entries(RULES)) {
      const answer = measure(file, text);
      if (answer !== undefined) found[rule][relative(path)] = answer;
    }
  }
  found["imports past a barrel"] = await pastABarrel(source);
  return sorted(found);
}

function sorted(found) {
  return Object.fromEntries(
    Object.entries(found).map(([rule, files]) => [
      rule,
      Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))),
    ]),
  );
}

/** The baseline on disk, which is committed and read by the guard beside this. */
export async function committed() {
  return JSON.parse(await readFile(BASELINE, "utf8"));
}

/**
 * Every way the tree is worse than the baseline, one file at a time.
 *
 * A file that got better is not a failure. Banking that is `--write`, and the
 * number going down in a reviewed diff is the point of writing it down at all.
 */
export function worseThan(baseline, now) {
  const worse = [];
  for (const [rule, files] of Object.entries(now)) {
    const was = baseline[rule] ?? {};
    for (const [path, answer] of Object.entries(files)) {
      worse.push(...grew({ rule, path, answer, before: was[path] }));
    }
  }
  return worse;
}

function grew(args) {
  const { rule, path, answer, before } = args;
  if (Array.isArray(answer)) {
    const added = answer.filter((one) => !(before ?? []).includes(one));
    return added.map((one) => `${path}: ${one} takes ${rule}, which the baseline does not list`);
  }
  if (before === undefined) return [`${path}: ${answer} ${rule}, and the baseline lists none`];
  if (answer > before) return [`${path}: ${answer} ${rule}, where the baseline holds ${before}`];
  return [];
}

if (process.argv[1]?.endsWith("charter.mjs")) {
  const now = await survey();
  if (process.argv.includes("--write")) {
    await writeFile(BASELINE, `${JSON.stringify(now, null, 2)}\n`, "utf8");
    const counts = Object.entries(now).map(
      ([rule, files]) => `${Object.keys(files).length} ${rule}`,
    );
    process.stdout.write(`wrote ${slashed(BASELINE)}\n  ${counts.join("\n  ")}\n`);
  } else {
    const worse = worseThan(await committed(), now);
    process.stdout.write(worse.length === 0 ? "nothing got worse\n" : `${worse.join("\n")}\n`);
    process.exitCode = worse.length === 0 ? 0 : 1;
  }
}

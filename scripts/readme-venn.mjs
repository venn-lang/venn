/**
 * Every Venn block in a package README, put through the checker that ships.
 *
 * The charter asks every package for a README with at least one example that
 * runs, and twenty-seven of the sixty-six blocks were refused: four packages
 * had no block that checked clean at all, which is the rule broken outright.
 * Half the refusals are a missing import whose exact line the diagnostic
 * already prints, and the rest need a judgement about what the block is for.
 *
 * So one rule is red now and one is frozen: a README that shows Venn must show
 * some Venn that checks, and no README may refuse more blocks than it does
 * today. The second is a number that only goes down.
 *
 * `node scripts/readme-venn.mjs --write` records the refusals. `--check` runs
 * them again. Both need `packages/cli/dist`, so this is a CI step after Build.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { everyBlock } from "./readme-fences.mjs";
import { ROOT, slashed } from "./repo-sources.mjs";

export const REFUSALS = join(ROOT, "scripts", "readme-venn-refusals.json");
const BINARY = join(ROOT, "packages", "cli", "dist", "bin", "venn-run.mjs");
const MANIFEST = '[package]\nname = "readme"\nversion = "0.0.0"\n';

/** One block checked on its own, in a project of its own. */
async function checked(block) {
  const dir = await mkdtemp(join(tmpdir(), "venn-readme-"));
  try {
    await writeFile(join(dir, "venn.toml"), MANIFEST, "utf8");
    await writeFile(join(dir, "block.vn"), `${block.body}\n`, "utf8");
    return await answered(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function answered(dir) {
  return new Promise((settle) => {
    execFile(
      process.execPath,
      [BINARY, "check", join(dir, "block.vn")],
      { cwd: dir, timeout: 60_000 },
      (error, stdout, stderr) => settle({ clean: !error, said: `${stdout}${stderr}` }),
    );
  });
}

const AT_A_TIME = 8;

/** Every block checked, a handful at a time, because each one is a process. */
export async function checkAll() {
  const blocks = await everyBlock();
  if (blocks.length === 0) throw new Error("no Venn block found in any package README");
  const answers = [];
  for (let from = 0; from < blocks.length; from += AT_A_TIME) {
    const batch = blocks.slice(from, from + AT_A_TIME);
    const said = await Promise.all(batch.map(checked));
    answers.push(...batch.map((block, at) => ({ ...block, ...said[at] })));
  }
  return answers;
}

/** How many blocks each README is refused on, with the clean ones left out. */
export function refusalsIn(answers) {
  const found = {};
  for (const one of answers.filter((answer) => !answer.clean)) {
    found[one.readme] = (found[one.readme] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** A README that shows Venn and no Venn that checks teaches only the broken one. */
export function withoutARunnableExample(answers) {
  const byReadme = new Map();
  for (const one of answers) byReadme.set(one.readme, [...(byReadme.get(one.readme) ?? []), one]);
  return [...byReadme]
    .filter(([, blocks]) => !blocks.some((one) => one.clean))
    .map(
      ([readme, blocks]) =>
        `${readme}: ${blocks.length} Venn blocks and not one the checker accepts`,
    );
}

export async function committed() {
  return JSON.parse(await readFile(REFUSALS, "utf8"));
}

/** Every README refusing more blocks than it was recorded refusing. */
export function moreThan(recorded, now) {
  const worse = [];
  for (const [readme, count] of Object.entries(now)) {
    const was = recorded[readme] ?? 0;
    if (count > was)
      worse.push(`${readme}: the checker refuses ${count} blocks, where ${was} was recorded`);
  }
  return worse;
}

if (process.argv[1]?.endsWith("readme-venn.mjs")) {
  const answers = await checkAll();
  const now = refusalsIn(answers);
  if (process.argv.includes("--write")) {
    await writeFile(REFUSALS, `${JSON.stringify(now, null, 2)}\n`, "utf8");
    const total = Object.values(now).reduce((so, one) => so + one, 0);
    process.stdout.write(
      `wrote ${slashed(REFUSALS)}: ${total} of ${answers.length} blocks refused\n`,
    );
  } else {
    const wrong = [...withoutARunnableExample(answers), ...moreThan(await committed(), now)];
    process.stdout.write(
      wrong.length === 0
        ? `${answers.length} blocks, none worse than recorded\n`
        : `${wrong.join("\n")}\n`,
    );
    process.exitCode = wrong.length === 0 ? 0 : 1;
  }
}

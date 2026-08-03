/**
 * Every example driven through the shipped binary, and what it did written down.
 *
 * `venn check examples/` was the only command the examples ever met, and it is
 * the one that was never broken. CI later gained a step that runs eight of the
 * seventy-eight, and asserts exit status alone, which is provably not enough:
 * `venn test` on a file with no flows prints `0 passed, 0 failed` and exits 0,
 * and `venn run` on a file that is all flows prints nothing and exits 0. Either
 * is exactly what a regression that dropped every flow would look like.
 *
 * So three things are pinned per entry: the exit status, the `passed` and
 * `failed` counted in the `run.finished` event, and both output streams,
 * normalized and kept apart because their interleaving is a race.
 *
 * `node scripts/examples-run.mjs --write` records what the tree does now.
 * `--check` runs them again and prints every entry that disagrees. It needs
 * `packages/cli/dist`, so it is a CI step after Build and not part of
 * `pnpm test`; what runs under `pnpm test` is the half that needs no build.
 */
import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { countsIn, normalize } from "./examples-normalize.mjs";
import { ROOT, relative, slashed } from "./repo-sources.mjs";

const A_WHILE = 120_000;

/**
 * The binary run once, with its input closed before it asks for any.
 *
 * Two examples read from the terminal, and `stdio: "ignore"` is not the same as
 * an input that ended: on Windows `09-terminal.vn` waits on it forever. An
 * empty pipe closed straight away is what a shell's `< /dev/null` does, and
 * both examples then finish in under a second.
 */
function spawned(args) {
  return new Promise((settle, refuse) => {
    const child = execFile(
      process.execPath,
      args,
      { cwd: ROOT, maxBuffer: 1 << 26, timeout: A_WHILE },
      (error, stdout, stderr) => {
        // A run that had to be killed is not a slow answer, it is no answer,
        // and recording it as one writes down an exit status nobody produced.
        if (error?.killed) refuse(new Error(`${args[2]} did not finish inside ${A_WHILE}ms`));
        else settle({ stdout, stderr, exit: error?.code ?? 0 });
      },
    );
    child.stdin.end();
  });
}

export const EXAMPLES = join(ROOT, "examples");
export const EXPECTED = join(ROOT, "scripts", "examples-expected.json");
const BINARY = join(ROOT, "packages", "cli", "dist", "bin", "venn-run.mjs");

/** Every `.vn` under `examples/`, in the order a person would read them. */
export async function everyExample(dir = EXAMPLES) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  const deeper = [];
  for (const entry of entries.toSorted((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) deeper.push(everyExample(path));
    else if (entry.name.endsWith(".vn")) found.push(relative(path));
  }
  return [...found, ...(await Promise.all(deeper)).flat()];
}

/**
 * Which command an example is for.
 *
 * A file holding a top-level `flow` is a test, and running it prints nothing.
 * Every other file is a program, including the modules the programs import,
 * which print nothing and are here so that a module that starts throwing on
 * load is a failure rather than a silence.
 */
const HAS_A_FLOW = /^(?:@\w+[^\n]*\n)*flow\s/m;

export async function commandFor(path) {
  const text = await readFile(join(ROOT, path), "utf8");
  return HAS_A_FLOW.test(text) ? "test" : "run";
}

/** What the binary did with one example, as the entry that gets written down. */
async function drive(path) {
  const command = await commandFor(path);
  const said = await spawned([
    BINARY,
    command,
    path,
    ...(command === "test" ? ["--reporter", "ndjson"] : []),
  ]);
  return entryOf({ command, said });
}

function entryOf(args) {
  const { command, said } = args;
  const entry = {
    command,
    exit: said.exit,
    stdout: normalize(said.stdout, ROOT),
    stderr: normalize(said.stderr, ROOT),
  };
  const counts = command === "test" ? countsIn(said.stdout) : undefined;
  return counts ? { ...entry, ...counts } : entry;
}

/** Every example driven, one at a time, because a race is not a measurement. */
export async function driveAll() {
  const found = {};
  for (const path of await everyExample()) found[path] = await drive(path);
  if (Object.keys(found).length === 0) throw new Error("no example found under examples/");
  return found;
}

export async function committed() {
  return JSON.parse(await readFile(EXPECTED, "utf8"));
}

const FIELDS = ["command", "exit", "passed", "failed", "stdout", "stderr"];

/** Every way an example now disagrees with what was written down for it. */
export function disagrees(expected, now) {
  const wrong = [];
  for (const [path, entry] of Object.entries(now)) {
    const was = expected[path];
    if (!was) {
      wrong.push(`${path}: no expectation recorded, run node scripts/examples-run.mjs --write`);
      continue;
    }
    wrong.push(...differs(path, was, entry));
  }
  for (const path of Object.keys(expected)) {
    if (!now[path]) wrong.push(`${path}: expected and no longer on disk`);
  }
  return wrong;
}

function differs(path, was, entry) {
  return FIELDS.filter((field) => (was[field] ?? null) !== (entry[field] ?? null)).map(
    (field) => `${path}: ${field} is ${show(entry[field])} where ${show(was[field])} was recorded`,
  );
}

const show = (value) =>
  typeof value === "string"
    ? JSON.stringify(value.length > 120 ? `${value.slice(0, 120)}…` : value)
    : String(value);

if (process.argv[1]?.endsWith("examples-run.mjs")) {
  const now = await driveAll();
  if (process.argv.includes("--write")) {
    await writeFile(EXPECTED, `${JSON.stringify(now, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${slashed(EXPECTED)}: ${Object.keys(now).length} examples\n`);
  } else {
    const wrong = disagrees(await committed(), now);
    process.stdout.write(
      wrong.length === 0
        ? `${Object.keys(now).length} examples, all as recorded\n`
        : `${wrong.join("\n")}\n`,
    );
    process.exitCode = wrong.length === 0 ? 0 : 1;
  }
}

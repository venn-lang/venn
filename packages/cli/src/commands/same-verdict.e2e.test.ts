import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkCommand, checkProblems } from "./check.js";
import { runCommand } from "./run.js";
import { scriptCommand } from "./script.js";

const NEWLINE = String.fromCharCode(10);
const lines = (...parts: readonly string[]): string => parts.join(NEWLINE);

let root = "";

/** A real directory: whether a `.env` is read is exactly the question. */
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "venn-verdict-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function write(name: string, source: string): Promise<string> {
  const path = join(root, name);
  await writeFile(path, source, "utf8");
  return path;
}

/** What `venn check` says, `venn run` says, and `venn test` says, in that order. */
async function verdicts(name: string): Promise<readonly number[]> {
  const file = join(root, name);
  const checked = await checkProblems([file]);
  const check = checked.problems.some((one) => one.severity === "error") ? 1 : 0;
  const script = await scriptCommand({ file });
  const test = await runCommand({ file, reporter: "dot" });
  return [check, script.code, test];
}

const MANIFEST = lines(
  "[package]",
  'name = "t"',
  'version = "1.0.0"',
  "",
  "[env.local]",
  'BASE = "http://x"',
);

/**
 * One project, three commands, one answer.
 *
 * `venn check` used to read only the `[env.*]` sections, `venn run` only the
 * environment it had resolved, and the editor a third thing. A token kept out
 * of the repository, which is what `.env` is for, failed the check and ran
 * fine; a file with no manifest was clean under one and refused by the other,
 * with a message naming a `venn.toml` the project did not have.
 */
describe("what a project declares", () => {
  it("counts a variable that only a dotenv file holds", async () => {
    await write("venn.toml", MANIFEST);
    await write(".env", "TOKEN=abc123");
    await write("main.vn", lines('import { env } from "venn/env"', "print env.TOKEN"));

    expect(await verdicts("main.vn")).toEqual([0, 0, 0]);
  });

  it("counts a variable only one environment declares", async () => {
    await write("venn.toml", lines(MANIFEST, "", "[env.staging]", 'ONLY_STAGING = "yes"'));
    await write("main.vn", lines('import { env } from "venn/env"', "print env.ONLY_STAGING"));

    expect(await verdicts("main.vn")).toEqual([0, 0, 0]);
  });

  it("refuses a name nothing declares, in every command", async () => {
    await write("venn.toml", MANIFEST);
    await write("main.vn", lines('import { env } from "venn/env"', "print env.NOWHERE"));

    expect(await verdicts("main.vn")).toEqual([1, 1, 1]);
  });

  /** Nothing to compare against, so nothing is refused, and all three agree on that. */
  it("says nothing at all where there is no manifest", async () => {
    await write("main.vn", lines('import { env } from "venn/env"', "print env.ANYTHING"));

    expect(await verdicts("main.vn")).toEqual([0, 0, 0]);
  });
});

/**
 * `print` under `venn test` wrote into a buffer nobody drained, so the natural
 * next step after a red test produced no information and no error. It is a
 * prelude verb, available everywhere, and it is how a person debugs a flow.
 *
 * It goes to standard error, because standard output belongs to the reporter: a
 * `print` among the NDJSON envelopes is a line nobody can parse, and one before
 * the XML prolog is not a JUnit file. Both streams reach the same terminal, so
 * a person still sees it, and a pipe still gets a clean report.
 */
describe("what a flow prints", () => {
  it("reaches the person under venn test, without touching the report", async () => {
    await write("flow.vn", lines('flow "F" {', '  step "s" { print "no meio" }', "}"));
    const out: string[] = [];
    const err: string[] = [];
    const onOut = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
    const onErr = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      err.push(String(chunk));
      return true;
    });

    await runCommand({ file: join(root, "flow.vn"), reporter: "ndjson" });
    onOut.mockRestore();
    onErr.mockRestore();

    expect(err.join("")).toContain("no meio");
    expect(out.join("")).not.toContain("no meio");
    for (const line of out.join("").split(NEWLINE).filter(Boolean)) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

/** Every `VNxxxx · title` and every `at …:line:col`, in the order it was said. */
function saidBy(chunks: readonly string[]): readonly string[] {
  return chunks
    .join("")
    .split(NEWLINE)
    .filter((line) => /^VN\d{4} ·|^ {2}at /.test(line))
    .map((line) => line.trim().replace(/^at .*[/\\]/, "at "));
}

/** Whatever a command wrote to standard error while it ran. */
async function stderrOf(run: () => Promise<unknown>): Promise<readonly string[]> {
  const said: string[] = [];
  const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    said.push(String(chunk));
    return true;
  });
  await run();
  spy.mockRestore();
  return saidBy(said);
}

const MIXED = lines(
  'import { io } from "venn/io"',
  "",
  'const count: number = "seven"',
  "print count",
);

/** The two the file holds, in the order a person reads them. */
const SAID = [
  'VN5005 · "io" is imported and never used.',
  "VN3010 · Type mismatch: expected number, found string.",
];

/**
 * One file, two commands, one list.
 *
 * A program that ran clean and failed `venn check` was the first thing a
 * newcomer met: the hint on line 1 was `venn check`'s business alone, and the
 * two commands were two compilers wearing one name. The order is half the
 * answer, since the analysis hands its problems over loudest first, which put
 * the error on line 3 in front of the hint on line 1.
 */
describe("what two commands say about one file", () => {
  it("says the same words, where they are written", async () => {
    const file = await write("mixed.vn", MIXED);

    const checked = await stderrOf(() => checkCommand({ paths: [file] }));
    const ran = await stderrOf(() => scriptCommand({ file }));

    expect(ran).toEqual(checked);
    expect(checked.filter((line) => line.startsWith("VN"))).toEqual(SAID);
  });
});

/** Said by all three, and worth nobody's exit code. */
describe("what a hint costs", () => {
  it("stops none of the three commands", async () => {
    await write("hinted.vn", lines('import { io } from "venn/io"', 'print "ran"'));

    expect(await verdicts("hinted.vn")).toEqual([0, 0, 0]);
  });
});

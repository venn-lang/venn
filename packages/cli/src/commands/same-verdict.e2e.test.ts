import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkProblems } from "./check.js";
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

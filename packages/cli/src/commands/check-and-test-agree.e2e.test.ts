import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkProblems } from "./check.js";
import { runCommand } from "./run.js";

const NEWLINE = String.fromCharCode(10);
const lines = (...parts: readonly string[]): string => parts.join(NEWLINE);

const A_WHILE = 60_000;

let root = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "venn-agree-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Every `VNxxxx` in a piece of text, deduped and ordered, so two surfaces compare. */
function codesIn(text: string): readonly string[] {
  return [...new Set(text.match(/VN\d{4}/g) ?? [])].sort();
}

/**
 * The codes a front end can find, by family: 1 syntax through 5 style. A 6 is
 * an assertion and a 7 is what an action did, and only running finds those.
 */
function beforeRunning(codes: readonly string[]): readonly string[] {
  return codes.filter((code) => Number(code[2]) < 6);
}

/** How many failures the JUnit roll-up claims, which is the number a CI job reads. */
function failuresIn(xml: string): number {
  return Number(/<testsuites[^>]*failures="(\d+)"/.exec(xml)?.[1] ?? -1);
}

/** The codes `venn check` refuses a file for. A warning is not a refusal. */
async function refusedByCheck(file: string): Promise<readonly string[]> {
  const { problems } = await checkProblems([file]);
  const errors = problems.filter((one) => one.severity === "error");
  return codesIn(errors.map((one) => one.code).join(" "));
}

/** What `venn test` left with, and the document it wrote for a machine to read. */
async function reportedByTest(file: string): Promise<{ exit: number; xml: string }> {
  const out: string[] = [];
  const onOut = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out.push(String(chunk));
    return true;
  });
  const onErr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    return { exit: await runCommand({ file, reporter: "junit" }), xml: out.join("") };
  } finally {
    onOut.mockRestore();
    onErr.mockRestore();
  }
}

interface Program {
  source: string;
  /** A `venn.toml` of its own, for the questions only a project can ask. */
  toml?: string;
}

interface Verdicts {
  /** The codes `venn check` refused the file for. */
  refused: readonly string[];
  /** The codes the JUnit document names, wherever in it they are filed. */
  reported: readonly string[];
  exit: number;
  failures: number;
}

/** One program in a project of its own, so a manifest belongs to it alone. */
async function laidOut(name: string, one: Program): Promise<string> {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  if (one.toml) await writeFile(join(dir, "venn.toml"), one.toml, "utf8");
  const file = join(dir, `${name}.vn`);
  await writeFile(file, one.source, "utf8");
  return file;
}

/** Both commands run over one file, side by side. */
async function bothOn(name: string, one: Program): Promise<Verdicts> {
  const file = await laidOut(name, one);
  const refused = await refusedByCheck(file);
  const { exit, xml } = await reportedByTest(file);
  return { refused, reported: codesIn(xml), exit, failures: failuresIn(xml) };
}

const CLEAN_TOML = lines("[package]", 'name = "t"', 'version = "1.0.0"');
const STRAY_TOML = lines(CLEAN_TOML, "", "nonsense = true");
const GREEN = lines('flow "F" {', '  step "s" { expect 1 == 1 }', "}");
const RED = lines('flow "F" {', '  step "s" { expect 1 == 2 }', "}");

/**
 * One program per way a file can be refused, and two that are not refused at all.
 *
 * `boom` is the one the four assertions above could not see: expansion refuses
 * a `deco` body that calls a prelude verb, and `venn check` said "no problems
 * found" and left with 0 for it. Every assertion that runs check -> test passes
 * on a check that says nothing, so it took the other direction to catch.
 */
const PROGRAMS: Readonly<Record<string, Program>> = {
  green: { source: GREEN },
  unreadable: { source: "const a = (1 + 2" },
  undeclared: { source: lines('flow "F" {', '  step "s" { expect nowhere == 1 }', "}") },
  misplaced: {
    source: lines(
      'flow "cut by a timeout" {',
      "  @timeout(30ms)",
      "  parallel {",
      '    step "one" { log "one" }',
      '    step "two" { log "two" }',
      "  }",
      "}",
    ),
  },
  strayKey: { source: GREEN, toml: STRAY_TOML },
  boom: {
    source: lines(
      "deco boom(target: Fn) {",
      '  fail "deco exploded"',
      "}",
      "",
      "@boom",
      "fn f() => 1",
      "",
      'flow "F" {',
      '  step "s" { expect f() == 1 }',
      "}",
    ),
  },
  red: { source: RED },
};

/** What the two commands said about each program of the corpus. */
async function everyVerdict(): Promise<ReadonlyMap<string, Verdicts>> {
  const said = new Map<string, Verdicts>();
  for (const [name, one] of Object.entries(PROGRAMS)) said.set(name, await bothOn(name, one));
  return said;
}

/**
 * A problem reaches the report, whichever of the two commands found it.
 *
 * The exit codes have agreed for a while and the report did not. A compile
 * problem went to standard error and never to the reporter, so `--reporter
 * junit` wrote `failures="0"` for a file the same tree refuses while the command
 * left with 1, and a job reading the XML saw green: venn-lang/venn#304. Two more
 * were open beside it, in the other direction. A stray `venn.toml` key was
 * `venn check`'s alone, because nothing read the manifest on the way to a run.
 * A decorator in the wrong place was found only by expansion, which happens as
 * the program runs, so both branches of a `parallel` ran to the end before
 * anything said the `@timeout` above them could not be there.
 *
 * Held on the codes rather than on a shape, so it covers any problem either
 * command can raise rather than the four that were filed, and asserted both
 * ways round. For a while it was only one way: every assertion ran check ->
 * test, which a check that says nothing satisfies, so a code the run reports
 * and the check never mentions went straight past it.
 */
describe("what a problem reaches", () => {
  it("puts every code venn check refuses for into the document", { timeout: A_WHILE }, async () => {
    const missing = [...(await everyVerdict())].flatMap(([name, said]) =>
      said.refused
        .filter((code) => !said.reported.includes(code))
        .map((code) => `${name}: ${code}`),
    );

    expect(missing).toEqual([]);
  });

  /**
   * A file the check refuses never runs, so the report has nothing else to say
   * about it. A project whose manifest is refused does run its files, and the
   * one in this corpus is green, so the same holds there.
   */
  it("and puts nothing else there than what it refused", { timeout: A_WHILE }, async () => {
    const extra = [...(await everyVerdict())]
      .filter(([, said]) => said.refused.length > 0)
      .filter(([, said]) => said.reported.join() !== said.refused.join())
      .map(([name, said]) => `${name}: reported ${said.reported} for refused ${said.refused}`);

    expect(extra).toEqual([]);
  });

  /** The half of #304 an exit code could never show: a green document beside a red run. */
  it("never calls a run clean that the command left 1 for", { timeout: A_WHILE }, async () => {
    const lying = [...(await everyVerdict())]
      .filter(([, said]) => (said.exit === 0) !== (said.failures === 0))
      .map(([name, said]) => `${name}: exit ${said.exit} beside failures="${said.failures}"`);

    expect(lying).toEqual([]);
  });

  it("leaves with 1 wherever venn check refuses", { timeout: A_WHILE }, async () => {
    const soft = [...(await everyVerdict())]
      .filter(([, said]) => said.refused.length > 0 && said.exit === 0)
      .map(([name]) => name);

    expect(soft).toEqual([]);
  });

  /**
   * The other direction, and the one that actually loses a checker.
   *
   * A code the run reports and `venn check` never mentions is a file that is
   * green in CI and red on the machine that runs it, which is the relation the
   * runtime states as `venn check is a subset of venn test`. Every assertion
   * above runs check -> test, and a check that says nothing satisfies all of
   * them: `boom` left `venn check` with 0 and `venn test` with 1 and passed the
   * lot. Families 1 to 5 are what a front end can find; a 6 is an assertion and
   * a 7 is what an action did, and the check is right to be silent about those.
   */
  it("refuses every code the report names from before the run", { timeout: A_WHILE }, async () => {
    const unseen = [...(await everyVerdict())].flatMap(([name, said]) =>
      beforeRunning(said.reported)
        .filter((code) => !said.refused.includes(code))
        .map((code) => `${name}: ${code}`),
    );

    expect(unseen).toEqual([]);
  });

  /**
   * A manifest key nothing reads is a failure, and no more than that.
   *
   * Refusing the project used to cancel the run with it: one stray key and
   * `venn test` executed zero flows, no `run.started`, no summary, and under
   * `--reporter dot` the whole output was a single `!`. `venn check` says the
   * manifest is wrong and checks every source anyway, and making the two
   * commands alike is the point of this file.
   */
  it("still runs the files under a refused manifest", { timeout: A_WHILE }, async () => {
    const first = await laidOut("twoFiles", { source: GREEN, toml: STRAY_TOML });
    await writeFile(join(dirname(first), "second.vn"), RED, "utf8");

    const { exit, xml } = await reportedByTest(dirname(first));

    expect(codesIn(xml)).toEqual(["VN2109", "VN6001"]);
    expect(exit).toBe(1);
    expect(xml).toContain("twoFiles.vn");
    expect(xml).toContain("second.vn");
  });

  /**
   * A corpus nobody wrote to disk would agree about nothing, in the same words,
   * and four of these are the four that were open. `red` is the control: a
   * failure only running can find, which the check is right to say nothing about
   * and the report is right to carry. `boom` is the one that reads the other
   * way, and it is pinned on both surfaces: a `venn check` that goes quiet about
   * it again is a green artifact over a run that leaves with 1.
   */
  it("is read from files both commands really ran", { timeout: A_WHILE }, async () => {
    const said = await everyVerdict();

    expect(said.size).toBe(Object.keys(PROGRAMS).length);
    expect(said.get("green")).toEqual({ refused: [], reported: [], exit: 0, failures: 0 });
    expect(said.get("misplaced")?.refused).toEqual(["VN2014"]);
    expect(said.get("strayKey")?.refused).toEqual(["VN2109"]);
    expect(said.get("unreadable")?.refused).toEqual(["VN1001"]);
    expect(said.get("undeclared")?.refused).toEqual(["VN2018"]);
    expect(said.get("boom")?.refused).toEqual(["VN2016"]);
    expect(said.get("boom")).toMatchObject({ reported: ["VN2016"], exit: 1, failures: 1 });
    expect(said.get("red")).toEqual({ refused: [], reported: ["VN6001"], exit: 1, failures: 1 });
  });

  /**
   * The document venn-lang/venn#304 was filed for, read by the two functions
   * every assertion above reads through. It left with 1 and this is what it
   * wrote, so `puts every code venn check refuses for into the document` and
   * `never calls a run clean` both fail on it, which is the only reason to trust
   * either. A reader that saw nothing in any document would agree with all four.
   */
  it("would have failed on the document #304 was filed for", () => {
    const filed = lines(
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<testsuites tests="2" failures="0" time="0.512">',
      '  <testsuite name="flowtimeout.vn" tests="2" failures="0" time="0.502">',
      '    <testcase classname="cut by a timeout" name="slow one"></testcase>',
      '    <testcase classname="cut by a timeout" name="slow two"></testcase>',
      "  </testsuite>",
      "</testsuites>",
    );

    expect(codesIn(filed)).toEqual([]);
    expect(failuresIn(filed)).toBe(0);
    expect(codesIn('<failure type="VN2014">')).toEqual(["VN2014"]);
    expect(failuresIn('<testsuites tests="1" failures="1">')).toBe(1);
  });
});

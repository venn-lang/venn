import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCommand } from "../commands/index.js";

const NEWLINE = String.fromCharCode(10);

/**
 * Issue #304, verbatim but for one character per step: `@timeout` decorates a
 * flow, a step or a group.
 *
 * The issue was filed with `log "one started"  wait 500ms`, two spaces and no
 * separator, and until VN2027 existed nothing said so: `wait` and its argument
 * were read as two more arguments to `log`, so neither "slow" step ever waited.
 * The `;` is what the report was always meant to say. It changes nothing this
 * file tests, because VN2014 refuses the run before either step is reached.
 */
const REFUSED = [
  'flow "cut by a timeout" {',
  "  @timeout(30ms)",
  "  parallel {",
  '    step "slow one" { log "one started"; wait 500ms }',
  '    step "slow two" { log "two started"; wait 500ms }',
  "  }",
  "}",
].join(NEWLINE);

/** A file the parser refuses, which never reaches a runner at all. */
const UNREADABLE = "const a = (1 + 2";

/** A flow that passes, so only the manifest can fail the run. */
const PASSING = ['flow "F" {', '  step "s" { log "hi" }', "}"].join(NEWLINE);

/** A file with something to say about it that is not worth stopping for. */
const UNTIDY = ['import { json } from "venn/json"', "", PASSING].join(NEWLINE);

/** A project whose `venn.toml` holds a table nothing reads. */
const MANIFEST = [
  "[package]",
  'name = "t"',
  'version = "1.0.0"',
  "",
  "[runner]",
  "workers = 4",
].join(NEWLINE);

/** What one invocation amounted to: its exit code and both of its streams. */
interface Ran {
  code: number;
  out: string;
  err: string;
}

/** One envelope, as a line of NDJSON reads back. */
interface Said {
  kind: string;
  seq: number;
  run: string;
  data?: { problem?: { code?: string } };
}

let root = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "venn-channel-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function capture(name: "stdout" | "stderr", into: string[]) {
  return vi.spyOn(process[name], "write").mockImplementation((chunk) => {
    into.push(String(chunk));
    return true;
  });
}

async function ran(args: { reporter: string; source?: string }): Promise<Ran> {
  const file = join(root, "t.vn");
  await writeFile(file, args.source ?? REFUSED, "utf8");
  const out: string[] = [];
  const err: string[] = [];
  const spies = [capture("stdout", out), capture("stderr", err)];
  try {
    const code = await runCommand({ file, reporter: args.reporter });
    return { code, out: out.join(""), err: err.join("") };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/** The document as a reader of it sees it, refusing anything ill-formed. */
function parsed(xml: string): Record<string, Record<string, unknown>> {
  expect(XMLValidator.validate(xml)).toBe(true);
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" }).parse(xml);
}

/** Everything in a list, whether the parser gave one back or a single node. */
function all(value: unknown): Record<string, unknown>[] {
  return value === undefined ? [] : [value].flat().map((one) => one as Record<string, unknown>);
}

/** The code of every `<failure>` in the document, wherever it is filed. */
function failureCodes(xml: string): string[] {
  const suites = all(parsed(xml).testsuites?.testsuite);
  const cases = suites.flatMap((suite) => all(suite.testcase));
  return cases.flatMap((one) => all(one.failure)).map((one) => String(one["@type"]));
}

/** Every envelope the NDJSON stream carried. */
function envelopes(ndjson: string): Said[] {
  return ndjson
    .split(NEWLINE)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Said);
}

/**
 * A file that fails the static check still runs, and what refused it used to go
 * to stderr alone: every reporter reads the event stream, so the machine
 * formats wrote a clean suite for a run the command exited 1 on, which is
 * exactly the file a CI job reads and exactly the wrong answer.
 *
 * One channel now. A problem found before the run travels on `failure`, the
 * same envelope one found during it travels on, so no reporter has to know
 * there were ever two kinds.
 */
describe("a problem the run was refused for", () => {
  it("is a failure in the junit document, and the exit code agrees", async () => {
    const { code, out, err } = await ran({ reporter: "junit" });

    expect(failureCodes(out)).toEqual(["VN2014"]);
    expect(code).toBe(1);
    expect(err).not.toContain("VN2014");
  });

  it("is counted in the document a CI job reads", async () => {
    const document = parsed((await ran({ reporter: "junit" })).out);

    expect(Number(document.testsuites?.["@failures"])).toBe(1);
  });

  it("reaches junit for a file the parser refused too", async () => {
    const { code, out } = await ran({ reporter: "junit", source: UNREADABLE });

    expect(failureCodes(out)).toEqual(["VN1001"]);
    expect(code).toBe(1);
  });

  /**
   * The rule about which problems stop a run is untouched: errors do, and a
   * hint is `venn check`'s business. One channel is not one severity, and an
   * untidy import failing a suite would be a worse answer than the silence was.
   */
  it("leaves a warning a warning", async () => {
    const { code, out } = await ran({ reporter: "junit", source: UNTIDY });

    expect(failureCodes(out)).toEqual([]);
    expect(code).toBe(0);
  });

  it("is an envelope on the ndjson stream, numbered into the run it belongs to", async () => {
    const stream = envelopes((await ran({ reporter: "ndjson" })).out);
    const failed = stream.filter((one) => one.kind === "failure");
    const seqs = stream.map((one) => Number(one.seq));

    expect(failed.map((one) => one.data?.problem?.code)).toEqual(["VN2014"]);
    // One run, numbered from one with nothing missing, whether the file was
    // refused before it ran or while it did.
    expect(seqs).toEqual(seqs.map((_one, index) => index + 1));
    expect(new Set(stream.map((one) => one.run)).size).toBe(1);
  });

  it("is a mark on the dot stream", async () => {
    expect((await ran({ reporter: "dot" })).out).toContain("!");
  });

  it("is in the tree the pretty reporter draws", async () => {
    const { out } = await ran({ reporter: "pretty" });

    expect(out).toContain("VN2014");
    expect(out).toContain("@timeout decorates a flow, a step or a group");
  });
});

/**
 * `venn check` reads the project manifest and `venn test` read nothing, so a
 * key nothing reads was an error under one command and invisible under the
 * other. It is the same phase now, with the same severity rule, and it lands
 * where every other refusal lands.
 */
describe("a project the manifest refuses", () => {
  it("fails the run, in the document as well as in the exit code", async () => {
    await writeFile(join(root, "venn.toml"), MANIFEST, "utf8");
    const { code, out } = await ran({ reporter: "junit", source: PASSING });

    expect(failureCodes(out)).toEqual(["VN2109"]);
    expect(code).toBe(1);
  });

  it("leaves a manifest that reads clean alone", async () => {
    await writeFile(join(root, "venn.toml"), MANIFEST.replace("[runner]", "[env.local]"), "utf8");
    const { code, out } = await ran({ reporter: "junit", source: PASSING });

    expect(failureCodes(out)).toEqual([]);
    expect(code).toBe(0);
  });
});

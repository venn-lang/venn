import { createTestHost } from "@venn-lang/contracts";
import { createFakeClient, okResponse } from "@venn-lang/http";
import { createMemorySink, type ModuleIo } from "@venn-lang/runtime";
import { describe, expect, it } from "vitest";
import { runFile } from "./run-file.js";

const HELLO = `module demo.hello
import { http } from "venn/http"

flow "Hello" {
  step "Ping" {
    const res = http.get "https://example.com"
    expect res.status == 200
  }
}`;

const WITH_BASE = `module demo.base
import { http } from "venn/http"

config { baseUrl: "https://api.test" }

flow "Base" {
  step "Ping" {
    const res = http.get "/health"
    expect res.status == 200
  }
}`;

describe("runFile · the M1 end-to-end slice", () => {
  it("resolves a relative path against config.baseUrl", async () => {
    const httpClient = createFakeClient({
      responses: { "https://api.test/health": okResponse({ status: 200 }) },
    });

    const outcome = await runFile({
      source: WITH_BASE,
      uri: "memory://base.vn",
      host: createTestHost(),
      sink: createMemorySink(),
      httpClient,
    });

    expect(outcome.problems).toEqual([]);
    expect(outcome.result?.failed).toBe(0);
    expect(outcome.result?.passed).toBe(1);
  });

  it("parses, runs http.get through the fake client, and passes offline", async () => {
    const sink = createMemorySink();
    const httpClient = createFakeClient({
      responses: { "https://example.com": okResponse({ status: 200 }) },
    });

    const outcome = await runFile({
      source: HELLO,
      uri: "memory://hello.vn",
      host: createTestHost(),
      sink,
      httpClient,
    });

    expect(outcome.problems).toEqual([]);
    expect(outcome.result?.failed).toBe(0);
    expect(outcome.result?.passed).toBe(1);
    expect(sink.envelopes.map((envelope) => envelope.kind)).toEqual([
      "run.started",
      "flow.started",
      "step.started",
      "action.started",
      "action.finished",
      "expect.passed",
      "step.finished",
      "flow.finished",
      "run.finished",
    ]);
    expect(sink.envelopes.map((envelope) => envelope.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("fails the expectation when the status differs", async () => {
    const sink = createMemorySink();
    const httpClient = createFakeClient({
      responses: { "https://example.com": okResponse({ status: 500, ok: false }) },
    });

    const outcome = await runFile({
      source: HELLO,
      uri: "memory://hello.vn",
      host: createTestHost(),
      sink,
      httpClient,
    });

    expect(outcome.result?.failed).toBe(1);
    expect(sink.envelopes.map((envelope) => envelope.kind)).toContain("expect.failed");
  });

  // The number `venn run` hands to the process: the seam the commands read.
  it("carries a program's own exit code out of the run", async () => {
    const outcome = await runFile({
      source: 'log "starting"\nexit 3\nlog "never"',
      uri: "memory://exit.vn",
      host: createTestHost(),
      sink: createMemorySink(),
      httpClient: createFakeClient({ responses: {} }),
      mode: "script",
    });

    expect(outcome.problems).toEqual([]);
    expect(outcome.result?.exitCode).toBe(3);
  });
});

/** A decorator the run has to expand, in a file the entry file's own checks never read. */
const IMPURE_DECO = `module lib
pub deco boom(target: Fn) {
  fail "deco exploded"
}`;

const IMPORTS_IT = `module main
import { boom } from "./lib.vn"

@boom
fn f() => 1

flow "F" {
  step "s" { expect f() == 1 }
}`;

const LIB_IO: ModuleIo = {
  read: async (uri) =>
    uri === "/lib.vn" ? IMPURE_DECO : Promise.reject(new Error(`no such module ${uri}`)),
  resolve: (_base, spec) => (spec === "./lib.vn" ? "/lib.vn" : spec),
};

/**
 * Nothing may follow `run.finished`: every consumer reads it as the end and
 * closes its file on it.
 *
 * A decorator refused while the program is expanded is only known once the
 * runner hands its result back, and those problems used to be said after the
 * ending. An NDJSON reader that stopped at `run.finished`, as the runtime
 * guarantees it may, dropped the only record of the refusal and read the run as
 * green, and `--reporter dot` drew its summary before the `!`. That is the
 * green-artifact-over-a-red-run defect of venn-lang/venn#304 one envelope later.
 */
describe("runFile · a problem the run itself found", () => {
  it("says it before the run's ending, never after", async () => {
    const sink = createMemorySink();

    const outcome = await runFile({
      source: IMPORTS_IT,
      uri: "/main.vn",
      host: createTestHost(),
      sink,
      httpClient: createFakeClient({ responses: {} }),
      io: LIB_IO,
    });

    expect(outcome.problems.map((one) => one.code)).toEqual(["VN2016"]);
    expect(sink.envelopes.map((one) => one.kind).slice(-2)).toEqual(["failure", "run.finished"]);
  });

  /** Held back, not renumbered out of order: a gap reads as a dropped envelope. */
  it("numbers the ending after what it waited for", async () => {
    const sink = createMemorySink();

    await runFile({
      source: IMPORTS_IT,
      uri: "/main.vn",
      host: createTestHost(),
      sink,
      httpClient: createFakeClient({ responses: {} }),
      io: LIB_IO,
    });

    const seqs = sink.envelopes.map((one) => one.seq);
    expect(seqs).toEqual(seqs.map((_, at) => at + 1));
  });
});

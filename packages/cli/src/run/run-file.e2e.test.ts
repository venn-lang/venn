import { createTestHost } from "@venn/contracts";
import { createFakeClient, okResponse } from "@venn/http";
import { createMemorySink } from "@venn/runtime";
import { describe, expect, it } from "vitest";
import { runFile } from "./run-file.js";

const HELLO = `module demo.hello
use "@venn/http"
use "@venn/assert"

flow "Hello" {
  step "Ping" {
    const res = http.get "https://example.com"
    expect res.status == 200
  }
}`;

const WITH_BASE = `module demo.base
use "@venn/http"
use "@venn/assert"

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

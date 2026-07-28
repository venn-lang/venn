import { createTestHost } from "@venn-lang/contracts";
import { type Envelope, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

function runnerWith(sink: MemorySink) {
  return createRunner({ host: createTestHost(), plugins: [], sink });
}

function logs(sink: MemorySink): string[] {
  return sink.envelopes
    .filter((event) => event.kind === "log")
    .map((event) => String((event.data as { message?: unknown }).message ?? ""));
}

function kinds(sink: MemorySink): Envelope["kind"][] {
  return sink.envelopes.map((envelope) => envelope.kind);
}

function flowsStarted(sink: MemorySink): string[] {
  return sink.envelopes
    .filter((event) => event.kind === "flow.started")
    .map((event) => String((event.data as { title?: unknown }).title ?? ""));
}

const TWO_FLOWS = `flow "A" {
  step "s" {
    expect true
    exit 0
    expect false
  }
}

flow "B" {
  step "t" { expect false }
}`;

describe("exit", () => {
  it("ends the run cleanly with 0, leaving the flows after it unrun", async () => {
    const sink = createMemorySink();
    const { ast, problems } = parse(TWO_FLOWS);
    expect(problems).toEqual([]);

    const result = await runnerWith(sink).run(ast);

    expect(result.exitCode).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
    expect(flowsStarted(sink)).toEqual(["A"]);
  });

  it("carries the code it was given", async () => {
    const { ast } = parse('flow "F" { step "s" { exit 3 } }');

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.exitCode).toBe(3);
    expect(result.failed).toBe(0);
  });

  it("still closes the event stream, so a reporter sees the run end", async () => {
    const sink = createMemorySink();
    const { ast } = parse('flow "F" { step "s" { exit 2 } }');

    await runnerWith(sink).run(ast);

    expect(kinds(sink).at(-1)).toBe("run.finished");
  });

  it("is not an error a `try` can catch — it ends the run, not the block", async () => {
    const { ast } = parse('flow "F" { step "s" { try { exit 4 } catch e { expect false } } }');

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.exitCode).toBe(4);
    expect(result.failed).toBe(0);
  });

  it("leaves a run that never called it without a code of its own", async () => {
    const { ast } = parse('flow "F" { step "s" { expect true } }');

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.exitCode).toBeUndefined();
  });

  it("stops a script at the statement that called it", async () => {
    const sink = createMemorySink();
    const { ast, problems } = parse('log "before"\nexit 7\nlog "after"');
    expect(problems).toEqual([]);

    const result = await runnerWith(sink).script(ast);

    expect(result.exitCode).toBe(7);
    expect(logs(sink)).toEqual(["before"]);
  });

  // `setup` runs before the first statement of a program, and an `exit` there is
  // still the program ending: the stream has to close, and the ending the file
  // declared has to be in place, or `teardown`/`on shutdown` never run at all.
  it("ends a program that exits in its `setup`, stream closed and all", async () => {
    const sink = createMemorySink();
    const { ast, problems } = parse('setup { exit 3 }\nlog "body"\nteardown { log "tidy" }');
    expect(problems).toEqual([]);

    const result = await runnerWith(sink).script(ast);

    expect(result.exitCode).toBe(3);
    expect(logs(sink)).toEqual([]);
    expect(kinds(sink).at(-1)).toBe("run.finished");
  });

  it("leaves with 1 when the code is not a number, never with 0", async () => {
    const { ast } = parse('exit "boom"');

    const result = await runnerWith(createMemorySink()).script(ast);

    expect(result.exitCode).toBe(1);
  });
});

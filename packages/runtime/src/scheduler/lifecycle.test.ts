// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test, where ${…} is the language's own interpolation.
import { createTestHost } from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

/** Prints what a hook saw, opens a named handle, and fails when asked to. */
function recorder(sink: string[]) {
  return definePlugin({
    name: "@t/hooks",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => {
          sink.push(input.args.map(String).join(" "));
        },
      }),
      defineAction({ name: "open", run: (_ctx, input) => ({ name: String(input.args[0]) }) }),
      defineAction({
        name: "boom",
        run: () => {
          throw new Error("db is down");
        },
      }),
    ],
  });
}

async function suite(source: string) {
  const out: string[] = [];
  const sink = createMemorySink();
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const runner = createRunner({
    host: createTestHost(),
    plugins: [recorder(out)],
    sink,
    env: { RUN_ID: "r-1" },
  });
  return { out, sink, result: await runner.run(ast) };
}

/**
 * Every Problem the run reported, in order.
 *
 * Read by what the envelope carries rather than by its kind: a hook that failed
 * is not an assertion, so it travels on `failure`, and an assertion beside it on
 * `expect.failed`.
 */
function problemsIn(sink: MemorySink): Problem[] {
  return sink.envelopes.flatMap((envelope) =>
    "problem" in envelope.data ? [envelope.data.problem] : [],
  );
}

describe("lifecycle hooks · the scope they run in", () => {
  // A hook in a parentless scope reads `env` as undefined, and an interpolated
  // undefined is the empty string: the cleanup below would target every run.
  it("gives setup and teardown the suite's own bindings", async () => {
    const { out } = await suite(
      [
        'const table = "orders"',
        'setup { io.print "seed ${table} for ${env.RUN_ID}" }',
        'teardown { io.print "delete from ${table} where run = ${env.RUN_ID}" }',
        'flow "F" { step "s" { io.print "body" } }',
      ].join("\n"),
    );

    expect(out).toEqual(["seed orders for r-1", "body", "delete from orders where run = r-1"]);
  });

  it("gives beforeEach and afterEach what the prologue opened", async () => {
    const { out } = await suite(
      [
        'const conn = io.open "db"',
        'beforeEach { io.print "before ${conn.name}" }',
        'afterEach { io.print "after ${conn.name}" }',
        'flow "F" { step "s" { io.print "body" } }',
      ].join("\n"),
    );

    expect(out).toEqual(["before db", "body", "after db"]);
  });

  it("keeps what a hook binds to itself", async () => {
    const { out } = await suite(
      ['setup { const local = "yes" }', 'flow "F" { step "s" { io.print "got [${local}]" } }'].join(
        "\n",
      ),
    );

    expect(out).toEqual(["got []"]);
  });
});

describe("lifecycle hooks · a hook that throws", () => {
  it("counts the failure, names the hook, and still finishes the run", async () => {
    const { out, sink, result } = await suite(
      ["setup { io.boom }", 'flow "F" { step "s" { io.print "body" } }'].join("\n"),
    );

    expect(result.failed).toBe(1);
    // The run walks on: the flows still run, and the reporters still get an end.
    expect(out).toEqual(["body"]);
    expect(sink.envelopes.map((envelope) => envelope.kind).at(-1)).toBe("run.finished");
    expect(problemsIn(sink)).toMatchObject([
      { code: "VN7004", title: "setup failed: db is down", span: { line: 1 } },
    ]);
  });

  it("reports a teardown that throws instead of losing the run's ending", async () => {
    const { sink, result } = await suite(
      ['flow "F" { step "s" { io.print "body" } }', "teardown { io.boom }"].join("\n"),
    );

    expect(result.failed).toBe(1);
    expect(problemsIn(sink).map((problem) => problem.title)).toEqual([
      "teardown failed: db is down",
    ]);
    expect(sink.envelopes.map((envelope) => envelope.kind).at(-1)).toBe("run.finished");
  });
});

describe("lifecycle hooks · a hook that exits", () => {
  // `exit` is not a failure and not the hook's to absorb: it is the run saying
  // how it went. Caught at the hook boundary, the code went nowhere and the
  // suite ran on as if the setup had said nothing.
  it("ends the run at an `exit` in setup, carrying its code", async () => {
    const { out, sink, result } = await suite(
      [
        "setup { exit 3 }",
        'flow "F" { step "s" { io.print "body" } }',
        'teardown { io.print "tidy" }',
      ].join("\n"),
    );

    expect(result.exitCode).toBe(3);
    expect(result.failed).toBe(0);
    // The flows never start, but what setup opened is still given back.
    expect(out).toEqual(["tidy"]);
    expect(sink.envelopes.map((envelope) => envelope.kind).at(-1)).toBe("run.finished");
  });

  it("ends the run at an `exit` in beforeEach", async () => {
    const { out, result } = await suite(
      ["beforeEach { exit 4 }", 'flow "F" { step "s" { io.print "body" } }'].join("\n"),
    );

    expect(result.exitCode).toBe(4);
    expect(out).toEqual([]);
  });
});

describe("`on` handlers", () => {
  // The handler is the last thing a flow does; thrown from there, the error had
  // nothing left above it to catch it and ended the whole run.
  it("reports a handler that throws instead of ending the run", async () => {
    const { sink, result } = await suite(
      ['flow "F" {', '  step "s" { expect false }', "  on failure { io.boom }", "}"].join("\n"),
    );

    // The expectation that failed, and the handler that failed reacting to it.
    expect(result.failed).toBe(2);
    expect(problemsIn(sink).map((problem) => problem.title)).toEqual([
      "Expectation failed: expect false",
      "on failure failed: db is down",
    ]);
    expect(sink.envelopes.map((envelope) => envelope.kind).at(-1)).toBe("run.finished");
  });
});

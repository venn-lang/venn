import { createTestHost, VennError } from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { defineAction, definePlugin, PLUGIN_CODES } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/** A verb that parks until it is called off, and one that cannot reach its host. */
const plugin = definePlugin({
  name: "@t/net",
  namespace: "t",
  actions: [
    defineAction({
      name: "park",
      // The executor form because the project targets ES2023, which has no
      // `withResolvers`. It parks for as long as it is left alone.
      run: (ctx) =>
        new Promise<number>((_settle, fail) => {
          ctx.signal?.addEventListener("abort", () => fail(new Error("called off")));
        }),
    }),
    defineAction({
      name: "refused",
      run: () => {
        throw new VennError({
          code: PLUGIN_CODES.VN7022_CONNECTION_REFUSED,
          message: "Nothing accepted a connection on 127.0.0.1:9.",
        });
      },
    }),
  ],
});

async function ran(source: string): Promise<{ sink: MemorySink; failed: number }> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  const result = await createRunner({ host: createTestHost(), plugins: [plugin], sink }).run(ast);
  return { sink, failed: result.failed };
}

/**
 * Every Problem the run put on the stream.
 *
 * Read by what the envelope carries rather than by its kind, because only the
 * three failure envelopes carry a `problem` and that is the invariant under test.
 */
function problemsIn(sink: MemorySink): Problem[] {
  return sink.envelopes.flatMap((envelope) =>
    "problem" in envelope.data ? [envelope.data.problem] : [],
  );
}

function logsIn(sink: MemorySink): unknown[] {
  return sink.envelopes.filter((envelope) => envelope.kind === "log").map((one) => one.data);
}

const OVER_A_MAP = `flow "F" {
  step "s" {
    const res = { data: [1] }
    forEach item in res { expect item > 0 }
  }
}`;

describe("a failure a flow could not handle", () => {
  // Flattened to a log line, the code and the location were gone: every reporter
  // read it as VN7001 "somewhere", whatever the runtime had actually raised.
  it("reaches the reporters as the Problem it is, code and span and all", async () => {
    const { sink } = await ran(OVER_A_MAP);

    expect(problemsIn(sink)).toMatchObject([
      {
        code: "VN3015",
        title: "forEach needs a list, and this is a map.",
        span: { line: 4 },
        help: "Name the list inside it, as in `forEach item in res.data`.",
      },
    ]);
  });

  /**
   * The code a `fail` chose, which used to be the one thing the flow boundary
   * threw away: it read the message off the error and emitted a log line, so
   * every failure that was not an assertion arrived as prose.
   */
  it("keeps the code a `fail` raised, rather than flattening it to a line", async () => {
    const { sink, failed } = await ran('flow "F" { step "s" { fail "db is down" } }');

    expect(failed).toBe(1);
    expect(problemsIn(sink)).toMatchObject([{ code: "VN6002", title: "db is down" }]);
    expect(logsIn(sink)).toEqual([]);
  });

  it("keeps VN8001 on a step that ran out of the time it was given", async () => {
    const source = 'flow "F" {\n  @timeout(20ms)\n  step "s" { t.park }\n}';
    const { sink, failed } = await ran(source);

    expect(failed).toBe(1);
    expect(problemsIn(sink)).toMatchObject([{ code: "VN8001" }]);
    expect(problemsIn(sink)[0]?.title).toContain("20ms");
  });

  it("keeps a plugin's own code, so an unreachable host still reads as one", async () => {
    const { sink, failed } = await ran('flow "F" { step "s" { t.refused } }');

    expect(failed).toBe(1);
    expect(problemsIn(sink)).toMatchObject([
      { code: "VN7022", title: "Nothing accepted a connection on 127.0.0.1:9." },
    ]);
    expect(logsIn(sink)).toEqual([]);
  });
});

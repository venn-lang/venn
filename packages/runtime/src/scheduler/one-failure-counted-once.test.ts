import { createTestHost } from "@venn-lang/contracts";
import { type Problem, parse, type Status } from "@venn-lang/core";
import { defineAction, definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner, type RunResult } from "../run/index.js";

interface Ran {
  sink: MemorySink;
  result: RunResult;
}

async function ran(source: string, plugin: PluginDefinition): Promise<Ran> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  const result = await createRunner({ host: createTestHost(), plugins: [plugin], sink }).run(ast);
  return { sink, result };
}

function problemsIn(sink: MemorySink): Problem[] {
  return sink.envelopes.flatMap((envelope) =>
    "problem" in envelope.data ? [envelope.data.problem] : [],
  );
}

function flowStatuses(sink: MemorySink): (Status | undefined)[] {
  return sink.envelopes
    .filter((envelope) => envelope.kind === "flow.finished")
    .map((envelope) => ("status" in envelope.data ? envelope.data.status : undefined));
}

const THREE_FLOWS = `flow "A" { step "s" { db.connect } }

flow "B" { step "s" { db.connect } }

flow "C" { step "s" { db.connect } }`;

/** The shape every pooling client has: connect once, hand the same promise out. */
function memoised(): PluginDefinition {
  let conn: Promise<void> | undefined;
  const connect = defineAction({
    name: "connect",
    run: () => (conn ??= Promise.reject(new Error("connect ECONNREFUSED"))),
  });
  return definePlugin({ name: "@t/db", version: "0", namespace: "db", actions: [connect] });
}

/** The other half of it: one error object, made once and thrown for ever. */
function shared(): PluginDefinition {
  const down = new Error("connect ECONNREFUSED");
  const connect = defineAction({
    name: "connect",
    run: () => {
      throw down;
    },
  });
  return definePlugin({ name: "@t/db", version: "0", namespace: "db", actions: [connect] });
}

/**
 * A failure is one propagation by one frame, not one object.
 *
 * Marking the thrown object for the life of the process meant every producer
 * that hands out the same instance twice reported once and lost the rest, and a
 * memoised rejected promise is enough to produce that: every awaiter of one
 * rejected promise gets the SAME `Error`. Three flows ran against a database
 * that was down and two of them finished green.
 *
 * "Already reported" is a question about ancestry: a frame does not repeat what
 * a frame below it said, and nothing else is a repeat. Two branches of a
 * `parallel` are neither one's ancestor, so both of them count.
 */
describe("one error instance, thrown by three flows", () => {
  it("is three failures when the promise behind it was memoised", async () => {
    const { sink, result } = await ran(THREE_FLOWS, memoised());

    expect(result.failed).toBe(3);
    expect(flowStatuses(sink)).toEqual(["failed", "failed", "failed"]);
    expect(problemsIn(sink)).toHaveLength(3);
  });

  it("is three failures when the error object itself is shared", async () => {
    const { sink, result } = await ran(THREE_FLOWS, shared());

    expect(result.failed).toBe(3);
    expect(flowStatuses(sink)).toEqual(["failed", "failed", "failed"]);
  });

  it("is one failure each for two concurrent branches that shared it", async () => {
    const source = `flow "F" {
  parallel { onError: "collect" } {
    step "x" { db.connect }
    step "y" { db.connect }
  }
}`;
    const { sink, result } = await ran(source, memoised());

    expect(result.failed).toBe(2);
    const finished = sink.envelopes.filter((envelope) => envelope.kind === "step.finished");
    expect(finished.map((one) => ("status" in one.data ? one.data.status : ""))).toEqual([
      "failed",
      "failed",
    ]);
  });
});

const NOTHING = definePlugin({ name: "@t/n", version: "0", namespace: "n", actions: [] });

/**
 * One assertion is one failure.
 *
 * A hook that failed used to be counted twice: once by the assertion, at the
 * line it was written on, and again by the block that wrapped it as VN7004. The
 * reader saw the same thing to fix printed twice under two codes, and the run's
 * total said two failures for one broken `setup`.
 */
describe("an assertion inside a lifecycle block", () => {
  it("counts once, under the name of the hook that could not do its job", async () => {
    const source = ["setup { expect false }", 'flow "F" { step "s" { expect true } }'].join("\n");
    const { sink, result } = await ran(source, NOTHING);

    expect({ passed: result.passed, failed: result.failed }).toEqual({ passed: 1, failed: 1 });
    expect(problemsIn(sink).map((problem) => problem.code)).toEqual(["VN7004"]);
  });

  it("counts once for a `defer` inside a step, the same way", async () => {
    const source = 'flow "F" {\n  step "s" {\n    defer { expect false }\n  }\n}';
    const { sink, result } = await ran(source, NOTHING);

    expect(result.failed).toBe(1);
    expect(problemsIn(sink).map((problem) => problem.code)).toEqual(["VN7004"]);
  });

  /** The hook is the outer name; a step below it already has a better one. */
  it("leaves a failure a step below already reported under that step's name", async () => {
    const source = [
      'flow "F" {',
      '  step "s" { expect false }',
      '  on failure { step "react" { fail "the pager was down" } }',
      "}",
    ].join("\n");
    const { sink, result } = await ran(source, NOTHING);

    expect(result.failed).toBe(2);
    expect(problemsIn(sink).map((problem) => problem.code)).toEqual(["VN6001", "VN6002"]);
  });
});

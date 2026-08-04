import { createTestHost } from "@venn-lang/contracts";
import { type EventKind, type Problem, parse, type Status } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner, type RunResult } from "../run/index.js";

/** What the step did after the check that failed, which is the whole question. */
interface Ran {
  seen: string[];
  sink: MemorySink;
  result: RunResult;
}

async function ran(source: string): Promise<Ran> {
  const seen: string[] = [];
  const record = defineAction({
    name: "record",
    run: (_ctx, input) => void seen.push(String(input.args[0])),
  });
  const plugin = definePlugin({ name: "@t/w", version: "0", namespace: "t", actions: [record] });
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  const result = await createRunner({ host: createTestHost(), plugins: [plugin], sink }).run(ast);
  return { seen, sink, result };
}

function problemsIn(sink: MemorySink): Problem[] {
  return sink.envelopes.flatMap((envelope) =>
    "problem" in envelope.data ? [envelope.data.problem] : [],
  );
}

function kindsIn(sink: MemorySink): EventKind[] {
  return sink.envelopes.map((envelope) => envelope.kind);
}

function stepStatus(sink: MemorySink): Status | undefined {
  const finished = sink.envelopes.find((envelope) => envelope.kind === "step.finished");
  return finished && "status" in finished.data ? finished.data.status : undefined;
}

/**
 * A failed `expect` ends the step.
 *
 * It is what gives the other two forms a meaning: `.soft` only says something if
 * the plain form stops, and `.all` only needs a name because it evaluates every
 * check before stopping once. Past a failed check the step works against a state
 * already known to be wrong, and a destructive verb written below it was never
 * meant to be reached.
 */
describe("a check the step lost", () => {
  it("stops the step, so nothing written below it runs", async () => {
    const { seen, sink, result } = await ran(`flow "F" {
  step "s" {
    expect 1 == 2
    t.record "after"
  }
}`);

    expect(seen).toEqual([]);
    expect(result.failed).toBe(1);
    expect(stepStatus(sink)).toBe("failed");
    expect(problemsIn(sink)).toMatchObject([{ code: "VN6001" }]);
  });

  /** How the specification spells an expected failure, which could not be written. */
  it("is a failure a `try` can catch, carrying VN6001", async () => {
    const { seen, result } = await ran(`flow "F" {
  step "s" {
    try {
      expect 1 == 2
    } catch e {
      t.record e.code
    }
  }
}`);

    expect(seen).toEqual(["VN6001"]);
    // Caught is handled: a failure the program expected is not the run's.
    expect(result.failed).toBe(0);
  });
});

describe("`.soft`", () => {
  it("records the failure and lets the step carry on, still failed at the end", async () => {
    const { seen, sink, result } = await ran(`flow "F" {
  step "s" {
    expect.soft 1 == 2
    t.record "after"
  }
}`);

    expect(seen).toEqual(["after"]);
    expect(result.failed).toBe(1);
    expect(kindsIn(sink)).toContain("expect.soft_failed");
    expect(kindsIn(sink)).not.toContain("expect.failed");
    expect(stepStatus(sink)).toBe("failed");
  });
});

describe("`.all`", () => {
  it("reports every failing check by its own name, then stops once", async () => {
    const { seen, sink, result } = await ran(`flow "F" {
  step "s" {
    const n = 5
    expect.all {
      n == 5
      n == 7
      n == 8
    }
    t.record "after"
  }
}`);

    expect(result.failed).toBe(2);
    expect(problemsIn(sink).map((problem) => problem.title)).toEqual([
      "Expectation failed: n == 7",
      "Expectation failed: n == 8",
    ]);
    expect(seen).toEqual([]);
  });

  /** A title is one line, and the block's own source is four. */
  it("titles each of them on one line, not with the whole block", async () => {
    const { sink } = await ran(`flow "F" {
  step "s" {
    const n = 5
    expect.all {
      n == 6
      n == 7
    }
  }
}`);

    for (const problem of problemsIn(sink)) {
      expect(problem.title.includes(String.fromCharCode(10))).toBe(false);
    }
    expect(problemsIn(sink)).toHaveLength(2);
  });

  it("says nothing when every check holds", async () => {
    const { sink, result } = await ran(`flow "F" {
  step "s" {
    const n = 5
    expect.all {
      n == 5
      n < 6
    }
  }
}`);

    expect(result.failed).toBe(0);
    expect(kindsIn(sink)).toContain("expect.passed");
  });
});

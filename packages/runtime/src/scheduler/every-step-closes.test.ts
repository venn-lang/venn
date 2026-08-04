import { createTestHost } from "@venn-lang/contracts";
import { type Envelope, type EventKind, parse, type Status } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

async function ran(source: string): Promise<MemorySink> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  await createRunner({ host: createTestHost(), plugins: [], sink }).run(ast);
  return sink;
}

function of(sink: MemorySink, kind: EventKind): Envelope[] {
  return sink.envelopes.filter((envelope) => envelope.kind === kind);
}

function statuses(sink: MemorySink, kind: EventKind): (Status | undefined)[] {
  return of(sink, kind).map((envelope) =>
    "status" in envelope.data ? envelope.data.status : undefined,
  );
}

/**
 * A step that ends any way at all still says it ended.
 *
 * Every control signal used to unwind past the finish: `step.started` was left
 * open, and the pretty reporter's buffered failure for that step was wiped by the
 * next step beginning. A `break` is not a verdict either, so a step merely cut
 * short is neither passed nor failed.
 */
describe("a step ended by a control signal", () => {
  it("is failed when something had already gone wrong in it", async () => {
    const sink = await ran(`flow "F" {
  forEach n in [1, 2] {
    step "s" {
      expect.soft 1 == 2
      break
    }
  }
}`);

    expect(statuses(sink, "step.finished")).toEqual(["failed"]);
  });

  it("is cancelled when it was merely cut short", async () => {
    const sink = await ran(`flow "F" {
  forEach n in [1, 2] {
    step "s" { break }
  }
}`);

    expect(statuses(sink, "step.finished")).toEqual(["cancelled"]);
  });

  /**
   * An `exit` unwound past `flow.finished`, so `--reporter junit` wrote
   * `tests="0" failures="0"` for a run that had executed steps.
   */
  it("closes the step and the flow when the program leaves", async () => {
    const sink = await ran('flow "F" {\n  step "s" { exit 0 }\n}');

    expect(statuses(sink, "step.finished")).toEqual(["cancelled"]);
    expect(statuses(sink, "flow.finished")).toEqual(["cancelled"]);
    expect(sink.envelopes.at(-1)?.kind).toBe("run.finished");
  });
});

const EVERY_WAY_OUT = `fragment tidy() {
  step "tidy" { return }
}

flow "F" {
  race {
    step "fast" { expect true }
    step "slow" { wait 5s }
  }
  parallel { onError: "collect" } {
    step "one" { expect.soft 1 == 2 }
    step "two" { expect true }
  }
  forEach n in [1, 2, 3] {
    step "each" {
      if n == 1 { continue }
      if n == 3 { break }
      expect true
    }
  }
  run tidy()
  step "last" { exit 0 }
}`;

/**
 * A macrotask of real time.
 *
 * Deterministic time control cannot answer this one: what is under test is that
 * nothing arrives after the run was reported, and a branch still unwinding lands
 * on the event loop rather than on a clock this test owns. The executor form
 * because the project targets ES2023, which has no `withResolvers`.
 */
function turn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

/**
 * The stream, read as a shape rather than as a list of assertions.
 *
 * Race, parallel, break, continue, return and exit in one program: whatever any
 * of them does to the walk, a reporter has to be able to close every step it was
 * told about, and nothing may arrive after the run has been reported.
 */
describe("every way out of a step, replayed", () => {
  it("closes every step and every flow it opened, and stops there", async () => {
    const sink = await ran(EVERY_WAY_OUT);
    const after = sink.envelopes.length;
    await turn();

    const started = of(sink, "step.started").map((envelope) => envelope.step);
    const finished = of(sink, "step.finished").map((envelope) => envelope.step);
    expect(started.filter((step) => step === undefined)).toEqual([]);
    expect([...finished].sort()).toEqual([...started].sort());
    expect(of(sink, "flow.finished")).toHaveLength(of(sink, "flow.started").length);
    expect(sink.envelopes.at(-1)?.kind).toBe("run.finished");
    expect(sink.envelopes).toHaveLength(after);
  });

  /**
   * One step plan, not two: the plan used to read one level of `stmts`, so a flow
   * whose steps live inside a `parallel`, a `forEach` or a fragment reported
   * `"steps": []`, and the reporter's progress bar had nothing to count.
   */
  it("plans every step it can reach, wherever it is written", async () => {
    const sink = await ran(EVERY_WAY_OUT);

    const plan = of(sink, "run.started")[0]?.data;
    const titles =
      plan && "plan" in plan ? plan.plan.flows[0]?.steps.map((step) => step.title) : [];
    expect(titles).toEqual(["fast", "slow", "one", "two", "each", "tidy", "last"]);
  });
});

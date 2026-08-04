// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test, where ${…} is the language's own interpolation.
import { createTestHost } from "@venn-lang/contracts";
import { type EventKind, parse, type Status } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner, type RunResult } from "../run/index.js";

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
  const plugin = definePlugin({ name: "@t/v", version: "0", namespace: "t", actions: [record] });
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  const result = await createRunner({ host: createTestHost(), plugins: [plugin], sink }).run(ast);
  return { seen, sink, result };
}

function kindsIn(sink: MemorySink): EventKind[] {
  return sink.envelopes.map((envelope) => envelope.kind);
}

/** Every step that closed, by the title it closed under. */
function verdicts(sink: MemorySink): Record<string, Status> {
  const pairs = sink.envelopes
    .filter((envelope) => envelope.kind === "step.finished")
    .flatMap((envelope): [string, Status][] => {
      const data = envelope.data;
      return "status" in data && "title" in data ? [[data.title, data.status]] : [];
    });
  return Object.fromEntries(pairs);
}

/**
 * A verdict is a question about one frame.
 *
 * The run's counter is one number shared by reference with every branch of a
 * `parallel`, so a step read it differentially and got its neighbours' answer:
 * pretty printed two crosses and then `1 failed | 1 passed`, contradicting
 * itself on the same screen, and junit and pretty disagreed outright.
 */
describe("a step beside one that failed", () => {
  it("passes, because a sibling's failure is not its own", async () => {
    const { sink, result } = await ran(`flow "F" {
  parallel { onError: "collect" } {
    step "slow-and-fine" {
      wait 50ms
      expect true
    }
    step "fails-fast" { fail "nope" }
  }
}`);

    expect(verdicts(sink)["slow-and-fine"]).toBe("passed");
    expect(verdicts(sink)["fails-fast"]).toBe("failed");
    expect(result.failed).toBe(1);
  });

  it("passes for every concurrent item of a `forEach` whose check held", async () => {
    const { sink, result } = await ran(`flow "F" {
  forEach n in [1, 2, 3, 4] { concurrency: 4 } {
    step "item \${n}" { expect n > 2 }
  }
}`);

    expect(verdicts(sink)["item 3"]).toBe("passed");
    expect(verdicts(sink)["item 4"]).toBe("passed");
    expect(verdicts(sink)["item 1"]).toBe("failed");
    expect(result.failed).toBe(2);
  });
});

/**
 * `@retry` re-runs work that failed, and only work that failed.
 *
 * Reading the shared counter, a step that did its job once was re-run because a
 * branch beside it had failed while it was running, and the snapshot restore
 * then put the counter back over that branch's failure: the side effects ran
 * twice and the run ended green with a genuine failure in it.
 */
describe("`@retry` beside a branch that failed", () => {
  it("runs the body once, does not retry, and leaves the sibling counted", async () => {
    const { seen, sink, result } = await ran(`flow "F" {
  parallel { onError: "collect" } {
    @retry(1)
    step "flaky-ish" {
      wait 50ms
      t.record "attempt"
    }
    step "really-fails" { expect false }
  }
}`);

    expect(seen).toEqual(["attempt"]);
    expect(kindsIn(sink)).not.toContain("flow.retrying");
    expect(result.failed).toBe(1);
  });
});

/**
 * Retry until green, which is the whole reason `@retry` exists in a language
 * for end-to-end tests.
 *
 * The discarded attempts used to leave their assertions on the stream, so every
 * reporter called a passing step a failure while the run exited 0: junit wrote a
 * passing testcase carrying two `<failure>` children, which marks the build red
 * in Jenkins and in GitLab. An assertion nobody catches last is an assertion
 * nobody reports, and a thrown-away attempt has nobody to catch it.
 */
describe("a step that passes on its third attempt", () => {
  it("says nothing about the two attempts it threw away", async () => {
    const { sink, result } = await ran(`let n = 0

flow "eventually green" {
  @retry(3)
  step "flaky" {
    n = n + 1
    expect n == 3
  }
}`);

    expect({ passed: result.passed, failed: result.failed }).toEqual({ passed: 1, failed: 0 });
    expect(result.exitCode).toBeUndefined();
    expect(kindsIn(sink)).not.toContain("expect.failed");
    expect(verdicts(sink).flaky).toBe("passed");
  });
});

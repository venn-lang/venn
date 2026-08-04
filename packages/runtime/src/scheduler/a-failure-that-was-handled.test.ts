import { createTestHost } from "@venn-lang/contracts";
import { type EventKind, parse } from "@venn-lang/core";
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
  const plugin = definePlugin({ name: "@t/h", version: "0", namespace: "t", actions: [record] });
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  const result = await createRunner({ host: createTestHost(), plugins: [plugin], sink }).run(ast);
  return { seen, sink, result };
}

function kindsIn(sink: MemorySink): EventKind[] {
  return sink.envelopes.map((envelope) => envelope.kind);
}

/**
 * `try { expect … } catch e { … }` is how the specification spells an expected
 * failure, and it has to leave nothing behind.
 *
 * A hard assertion used to report before it threw, so a caught one sat on the
 * stream for every reporter to draw: junit wrote `failures="1"` for a run the
 * CLI exited 0 for, pretty printed a FAILURES section under a green summary,
 * and dot printed `F` for a check the program expected to lose.
 */
describe("the expected-failure idiom", () => {
  it("leaves no failure on the stream, and still binds VN6001", async () => {
    const { seen, sink, result } = await ran(`flow "F" {
  step "s" {
    try {
      expect 1 == 2
    } catch e {
      t.record e.code
    }
  }
}`);

    expect(seen).toEqual(["VN6001"]);
    expect(result.failed).toBe(0);
    expect(kindsIn(sink)).not.toContain("expect.failed");
    expect(kindsIn(sink)).not.toContain("failure");
  });

  /** `.all` carries every check it lost, so a caught one reports none of them. */
  it("reports none of an `.all` block's checks when the block was caught", async () => {
    const { sink, result } = await ran(`flow "F" {
  step "s" {
    const n = 5
    try {
      expect.all {
        n == 6
        n == 7
      }
    } catch e {
      t.record e.code
    }
  }
}`);

    expect(result.failed).toBe(0);
    expect(kindsIn(sink)).not.toContain("expect.failed");
  });
});

/**
 * A `try` handles one propagation. It does not un-say what was already said.
 *
 * The counter rollback took the run's total back to what it was before the
 * block, so everything reported while the block was running went with it: a
 * `.soft` recorded deliberately, a step that failed under its own name, and,
 * because the counter is shared by reference, a concurrent sibling's failure.
 */
describe("what a `try` may not erase", () => {
  it("keeps a soft failure recorded before the throw it handled", async () => {
    const { result } = await ran(`flow "F" {
  step "s" {
    try {
      expect.soft false
      fail "boom"
    } catch e {
      log "handled"
    }
  }
}`);

    expect(result.failed).toBe(1);
  });

  it("keeps the verdict of a step it did not handle", async () => {
    const { sink, result } = await ran(`flow "F" {
  try {
    step "a" { expect false }
    fail "boom"
  } catch e {
    log "handled"
  }
}`);

    expect(result.failed).toBe(1);
    const finished = sink.envelopes.find((envelope) => envelope.kind === "step.finished");
    expect(finished && "status" in finished.data ? finished.data.status : "").toBe("failed");
  });

  it("keeps a concurrent sibling's failure, which was never its to handle", async () => {
    const { result } = await ran(`flow "F" {
  parallel { onError: "collect" } {
    step "handles its own" {
      try {
        fail "expected"
      } catch e {
        log "handled"
      }
    }
    step "genuinely fails" { fail "nope" }
  }
}`);

    expect(result.failed).toBe(1);
  });
});

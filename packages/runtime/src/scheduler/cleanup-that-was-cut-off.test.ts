import { createSystemClock, createTestHost } from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner, type RunResult } from "../run/index.js";

/** One run of a program whose cleanup had to survive something. */
interface Ran {
  logs: string[];
  problems: Problem[];
  result: RunResult;
}

/** A real clock, because every deadline and every race here is a reading of one. */
async function ran(source: string): Promise<Ran> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  const host = createTestHost({ clock: createSystemClock() });
  const result = await createRunner({ host, plugins: [], sink }).run(ast);
  return { logs: logsIn(sink), problems: problemsIn(sink), result };
}

function logsIn(sink: MemorySink): string[] {
  return sink.envelopes.flatMap((envelope) =>
    envelope.kind === "log" && "message" in envelope.data ? [String(envelope.data.message)] : [],
  );
}

function problemsIn(sink: MemorySink): Problem[] {
  return sink.envelopes.flatMap((envelope) =>
    "problem" in envelope.data ? [envelope.data.problem] : [],
  );
}

const TIMED_OUT = `flow "F" {
  @timeout(50ms)
  step "slow" {
    setup { log "setup" }
    teardown { log "teardown" }
    defer { log "defer" }
    wait 500ms
  }
}`;

/**
 * A `teardown` is written for the case its block did not reach the end, and a
 * deadline is that case.
 *
 * It ran on the engine the block ran on, so the first statement of the hook hit
 * the checkpoint that throws the timeout: the body never ran, and the timeout
 * that had already been reported once was reported again as a `VN7004` against
 * the hook. One timeout, two failures, and the line that closes the connection
 * never reached.
 */
describe("a step cut short by its own @timeout", () => {
  it("still runs the teardown it wrote, and the defer after it", async () => {
    const { logs } = await ran(TIMED_OUT);

    expect(logs).toEqual(["setup", "teardown", "defer"]);
  });

  it("counts the one timeout once, under the code the reader was given", async () => {
    const { problems, result } = await ran(TIMED_OUT);

    expect(problems.map((problem) => problem.code)).toEqual(["VN8001"]);
    expect(result.failed).toBe(1);
  });
});

const LOSER = `flow "F" {
  step "outer" {
    race {
      step "fast" { wait 5ms }
      step "slow" {
        teardown { log "loser teardown" }
        defer { log "loser defer" }
        wait 300ms
      }
    }
  }
}`;

/**
 * The same defect with nothing at all to show for it: a losing branch is called
 * off with a control signal, so the hook that could not run was not even
 * reported. The `defer` beside it ran, which is what says the two disagree.
 */
describe("a race branch that lost", () => {
  it("gives back what it opened, teardown before defer", async () => {
    const { logs, result } = await ran(LOSER);

    expect(logs).toEqual(["loser teardown", "loser defer"]);
    expect(result.failed).toBe(0);
  });
});

const EACH_LOSER = `flow "F" {
  step "outer" {
    race {
      afterEach { log "each after" }
      step "fast" { wait 5ms }
      step "slow" { wait 300ms }
    }
  }
}`;

/** `afterEach` is the same promise about the same block, once per step. */
describe("an afterEach around a step that was called off", () => {
  it("runs after the loser too, not only after the step that finished", async () => {
    const { logs } = await ran(EACH_LOSER);

    expect(logs).toEqual(["each after", "each after"]);
  });
});

const CANCELLED_BRANCH = `flow "F" {
  step "outer" {
    parallel {
      step "slow" {
        teardown { log "branch teardown" }
        wait 300ms
      }
      step "boom" {
        wait 20ms
        fail "the pager was down"
      }
    }
  }
}`;

/**
 * `onError: "cancel"` is the documented default, so a sibling's failure is how
 * most `parallel` branches end. Cleanup that skips exactly then is cleanup that
 * never runs when it is needed.
 */
describe("a parallel branch cancelled by a sibling's failure", () => {
  it("runs the branch's teardown, and the failure is still the sibling's one", async () => {
    const { logs, result } = await ran(CANCELLED_BRANCH);

    expect(logs).toEqual(["branch teardown"]);
    expect(result.failed).toBe(1);
  });
});

const EXIT_IN_SETUP = `flow "F" {
  setup {
    log "flow setup"
    exit 3
  }
  step "s" { log "body" }
  teardown { log "flow teardown" }
}`;

const EXIT_IN_FILE_SETUP = `setup {
  log "file setup"
  exit 3
}

flow "F" {
  step "s" { log "body" }
}

teardown { log "file teardown" }`;

/**
 * Where a hook is written is not what it means: `setup` and `teardown` are one
 * pair wherever the pair is written, so an `exit` in the first has to leave the
 * second standing at every level. A file's pair already read that way, and a
 * flow's did not, because the `setup` ran outside the `try` that runs the
 * `teardown`.
 */
describe("an exit inside a block's setup", () => {
  it("still runs that block's teardown, and never starts the block's steps", async () => {
    const { logs, result } = await ran(EXIT_IN_SETUP);

    expect(logs).toEqual(["flow setup", "flow teardown"]);
    expect(result.exitCode).toBe(3);
  });

  it("reads the same one level up, which is where the contract was written", async () => {
    const { logs, result } = await ran(EXIT_IN_FILE_SETUP);

    expect(logs).toEqual(["file setup", "file teardown"]);
    expect(result.exitCode).toBe(3);
  });
});

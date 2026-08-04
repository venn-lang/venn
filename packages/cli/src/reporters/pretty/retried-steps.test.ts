import { describe, expect, it } from "vitest";
import {
  captureStdout,
  finished,
  flow,
  flowDone,
  raised,
  retrying,
  said,
  started,
} from "../events.suite.js";
import type { Reporter } from "../reporter.types.js";
import { createPrettyReporter } from "./pretty-reporter.js";

/** Everything the tree reporter writes while it is driven. */
function capture(drive: (reporter: Reporter) => void): string {
  return captureStdout(() => drive(createPrettyReporter()));
}

const FLAKY = {
  code: "VN6001",
  title: "expected 1 to equal 3",
  span: { uri: "flows/flaky.vn", line: 4, column: 5 },
};

/**
 * A step `@retry` brought to green, as a person reading the terminal sees it.
 *
 * `@retry(3)` on a step that fails twice and passes exited 0 and still printed
 * the step with a tick, two reason lines under it and a two-item FAILURES block.
 * Retry-until-green is the reason `@retry` exists in an E2E language, so a run
 * that ends green has to read as one.
 */
describe("a step retried until it passed", () => {
  it("keeps the attempts it threw away out of the summary", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Eventually green"));
      reporter.sink.emit(started({ title: "flaky", step: "s1" }));
      reporter.sink.emit(raised({ problem: FLAKY, kind: "expect.soft_failed", step: "s1" }));
      reporter.sink.emit(retrying({ title: "flaky", step: "s1" }));
      reporter.sink.emit(finished({ title: "flaky", step: "s1" }));
      reporter.finish({ passed: 1, failed: 0, files: 1, ms: 3 });
    });

    expect(output).toContain("✓ flaky");
    expect(output).not.toContain("FAILURES");
    expect(output).not.toContain("VN6001");
  });

  it("keeps what a discarded attempt logged out of the attempt that passed", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Eventually green"));
      reporter.sink.emit(started({ title: "flaky", step: "s1" }));
      reporter.sink.emit(said({ message: "attempt one", step: "s1" }));
      reporter.sink.emit(retrying({ title: "flaky", step: "s1" }));
      reporter.sink.emit(said({ message: "attempt two", step: "s1" }));
      reporter.sink.emit(finished({ title: "flaky", step: "s1" }));
      reporter.finish({ passed: 1, failed: 0, files: 1, ms: 3 });
    });

    expect(output).toContain("attempt two");
    expect(output).not.toContain("attempt one");
  });

  /**
   * `@retry` on a flow runs its steps again, so the attempt it threw away takes
   * every one of their failures with it. What the tree already printed stands:
   * it was said as it happened, and the summary is what has to agree with the
   * verdict.
   */
  it("takes a discarded flow attempt's failures with it", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Eventually green"));
      reporter.sink.emit(started({ title: "flaky", step: "s1" }));
      reporter.sink.emit(raised({ problem: FLAKY, step: "s1" }));
      reporter.sink.emit(finished({ title: "flaky", status: "failed", step: "s1" }));
      reporter.sink.emit(retrying({ title: "Eventually green" }));
      reporter.sink.emit(started({ title: "flaky", step: "s2" }));
      reporter.sink.emit(finished({ title: "flaky", step: "s2" }));
      reporter.sink.emit(flowDone({ title: "Eventually green" }));
      reporter.finish({ passed: 1, failed: 0, files: 1, ms: 6 });
    });

    expect(output).not.toContain("FAILURES");
    expect(output).toContain("1 passed");
    expect(output).not.toContain("failed");
  });

  /** A retry that never came good still answers for the attempt that ended it. */
  it("keeps the last attempt's failure when every attempt lost", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Never green"));
      reporter.sink.emit(started({ title: "flaky", step: "s1" }));
      reporter.sink.emit(retrying({ title: "flaky", step: "s1" }));
      reporter.sink.emit(raised({ problem: FLAKY, step: "s1" }));
      reporter.sink.emit(finished({ title: "flaky", status: "failed", step: "s1" }));
      reporter.finish({ passed: 0, failed: 1, files: 1, ms: 4 });
    });

    expect(output).toContain("FAILURES");
    expect(output).toContain("expected 1 to equal 3");
  });
});

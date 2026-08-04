// biome-ignore-all lint/suspicious/noControlCharactersInRegex: a control character reaching the document is the defect under test.

import { describe, expect, it } from "vitest";
import { finished, flow, flowDone, raised, retrying, runDone, started } from "./events.suite.js";
import { createJunitReporter } from "./junit-reporter.js";
import type { Reporter, RunTotals } from "./reporter.types.js";

const ASSERTION = {
  code: "VN6001",
  title: 'expected "pending" to equal "paid"',
  span: { uri: "flows/checkout.vn", line: 10, column: 5 },
  help: "Charge the order before you read its status.",
};

const HOOK = {
  code: "VN7004",
  title: "setup failed: db is down",
  span: { uri: "flows/checkout.vn", line: 1, column: 1 },
};

const AWKWARD = {
  code: "VN6001",
  title: 'expected <b> & "quoted" to equal 3 > 2',
  span: { uri: "flows/checkout.vn", line: 2, column: 1 },
};

/** What a coloured CLI printed, quoted into `fail "${output}"`. */
const COLOURED = {
  code: "VN7001",
  title: "\u001b[31mgot 404\u001b[0m\nexpected 200",
  span: { uri: "flows/checkout.vn", line: 3, column: 1 },
  help: "run \u001b[1mvenn test\u001b[0m again",
};

const TOTALS: RunTotals = { passed: 1, failed: 1, files: 1, ms: 40 };

/** Every document the reporter wrote for one whole invocation. */
function documents(drive: (reporter: Reporter) => void): string[] {
  const written: string[] = [];
  const reporter = createJunitReporter({ write: (one) => written.push(one) });
  drive(reporter);
  reporter.finish(TOTALS);
  return written;
}

/** One file's worth of events, and the single document they amount to. */
function junit(drive: (sink: Reporter["sink"]) => void): string {
  const written = documents((reporter) => {
    reporter.beginFile("flows/checkout.vn");
    drive(reporter.sink);
    reporter.sink.emit(runDone({ passed: 1, failed: 1 }));
  });

  expect(written).toHaveLength(1);
  return written[0] ?? "";
}

/** A file with one step that passed, as `venn test <directory>` drives it. */
function passingFile(reporter: Reporter, file: string): void {
  reporter.beginFile(file);
  reporter.sink.emit(flow("Checkout"));
  reporter.sink.emit(started({ title: "Charge", step: "a" }));
  reporter.sink.emit(finished({ title: "Charge", step: "a" }));
  reporter.sink.emit(flowDone({ title: "Checkout" }));
  reporter.sink.emit(runDone({ passed: 1, failed: 0 }));
}

/**
 * A CI report is the only account of a run nobody watched.
 *
 * It said `<testcase name="assertions"><failure/></testcase>`: no step, no
 * message, no code, no location, for a problem that had all four. The failure
 * was built once and dropped here, which is the epic in one file.
 */
describe("a run as junit xml", () => {
  it("emits one testcase per step, under the flow it belongs to", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Checkout"));
      sink.emit(started({ title: "Charge", step: "a" }));
      sink.emit(finished({ title: "Charge", step: "a" }));
      sink.emit(started({ title: "Refund", step: "b" }));
      sink.emit(finished({ title: "Refund", step: "b" }));
      sink.emit(flowDone({ title: "Checkout" }));
    });

    expect(xml).toContain('<testcase classname="Checkout" name="Charge"></testcase>');
    expect(xml).toContain('<testcase classname="Checkout" name="Refund"></testcase>');
    expect(xml).toContain('<testsuites tests="2" failures="0"');
    expect(xml.match(/<testsuite /g)).toHaveLength(1);
  });

  /**
   * `venn test <directory>` is how a suite runs in CI, and it drove one sink per
   * file: N files gave N concatenated documents, each with its own declaration
   * and its own root, and a reader stops at the second declaration.
   */
  it("writes one document for every file the run covered", () => {
    const written = documents((reporter) => {
      for (const file of ["a.vn", "b.vn", "c.vn"]) passingFile(reporter, file);
    });
    const xml = written[0] ?? "";

    expect(written).toHaveLength(1);
    expect(xml.match(/<\?xml/g)).toHaveLength(1);
    expect(xml.match(/<testsuites /g)).toHaveLength(1);
    expect(xml.match(/<testsuite /g)).toHaveLength(3);
    expect(xml.match(/<testcase /g)).toHaveLength(3);
    expect(xml).toContain('<testsuite name="b.vn" tests="1" failures="0"');
  });

  it("names each suite for the file it ran, and the run for what it took", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Checkout"));
      sink.emit(started({ title: "Charge", step: "a" }));
      sink.emit(finished({ title: "Charge", step: "a" }));
    });

    expect(xml).toContain('<testsuite name="flows/checkout.vn"');
    expect(xml).toContain('time="0.012"');
    expect(xml).toContain('<testsuites tests="1" failures="0" time="0.040">');
  });

  it("says what failed, where, and what to do about it", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Checkout"));
      sink.emit(started({ title: "Charge", step: "a" }));
      sink.emit(raised({ problem: ASSERTION, step: "a" }));
      sink.emit(finished({ title: "Charge", status: "failed", step: "a" }));
    });

    expect(xml).toContain('message="expected &quot;pending&quot; to equal &quot;paid&quot;"');
    expect(xml).toContain('type="VN6001"');
    expect(xml).toContain("at    flows/checkout.vn:10:5");
    expect(xml).toContain("help  Charge the order before you read its status.");
    expect(xml).toContain('<testsuites tests="1" failures="1"');
  });

  it("counts a step once however many times it failed", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Checkout"));
      sink.emit(started({ title: "Charge", step: "a" }));
      sink.emit(raised({ problem: ASSERTION, kind: "expect.soft_failed", step: "a" }));
      sink.emit(raised({ problem: ASSERTION, kind: "failure", step: "a" }));
      sink.emit(finished({ title: "Charge", status: "failed", step: "a" }));
    });

    expect(xml.match(/<failure /g)).toHaveLength(2);
    expect(xml).toContain('<testsuites tests="1" failures="1"');
  });

  // Two steps open at once is what `parallel` emits, and each one answers for
  // its own failure or the report blames whichever step finished last.
  it("files each parallel branch's failure on that branch", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Fan out"));
      sink.emit(started({ title: "Alpha", step: "a" }));
      sink.emit(started({ title: "Beta", step: "b" }));
      sink.emit(raised({ problem: ASSERTION, step: "a" }));
      sink.emit(finished({ title: "Alpha", status: "failed", step: "a" }));
      sink.emit(finished({ title: "Beta", step: "b" }));
    });
    const beta = xml.slice(xml.indexOf('name="Beta"'));

    expect(xml.slice(xml.indexOf('name="Alpha"'))).toContain("<failure ");
    expect(beta).not.toContain("<failure ");
    expect(xml).toContain('<testsuites tests="2" failures="1"');
  });

  /** A `setup` that blew up belongs to no step, and to the flow all the same. */
  it("gives a failure that belongs to no step a testcase named for the flow", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Checkout"));
      sink.emit(raised({ problem: HOOK, kind: "failure" }));
      sink.emit(started({ title: "Charge", step: "a" }));
      sink.emit(finished({ title: "Charge", step: "a" }));
    });

    expect(xml).toContain('classname="Checkout" name="Checkout"');
    expect(xml).toContain('message="setup failed: db is down"');
    expect(xml).toContain('type="VN7004"');
    expect(xml).toContain('<testsuites tests="2" failures="1"');
  });

  /**
   * A file's `teardown` fails after the last flow closed, so it belongs to no
   * flow: filed under the one that happened to run last, a CI report blames a
   * flow that passed.
   */
  it("borrows no flow's name for a failure that arrived after the last flow", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Checkout"));
      sink.emit(started({ title: "Charge", step: "a" }));
      sink.emit(finished({ title: "Charge", step: "a" }));
      sink.emit(flowDone({ title: "Checkout" }));
      sink.emit(raised({ problem: HOOK, kind: "failure" }));
    });

    expect(xml).toContain('<testcase classname="" name="lifecycle">');
    expect(xml).not.toContain('classname="Checkout" name="Checkout"');
  });

  it("reports a step that was cut short as neither passed nor failed", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Race"));
      sink.emit(started({ title: "Slow", step: "a" }));
      sink.emit(flowDone({ title: "Race", status: "cancelled" }));
    });

    expect(xml).toContain('<testcase classname="Race" name="Slow"><skipped/></testcase>');
    expect(xml).toContain('<testsuites tests="1" failures="0"');
  });

  /**
   * `@retry` exists so a flaky step can end green, and a green step carrying the
   * `<failure>` children of the attempts before it marks the build red.
   */
  it("takes what a retried attempt collected out with the attempt", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Eventually green"));
      sink.emit(started({ title: "flaky", step: "a" }));
      sink.emit(raised({ problem: ASSERTION, kind: "expect.soft_failed", step: "a" }));
      sink.emit(retrying({ title: "flaky", step: "a" }));
      sink.emit(finished({ title: "flaky", step: "a" }));
      sink.emit(flowDone({ title: "Eventually green" }));
    });

    expect(xml).not.toContain("<failure ");
    expect(xml).toContain('<testsuites tests="1" failures="0"');
  });

  /** `@retry` on the flow discards its steps too: it runs all of them again. */
  it("takes a discarded flow attempt's cases out with it", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Eventually green"));
      sink.emit(started({ title: "flaky", step: "a" }));
      sink.emit(raised({ problem: ASSERTION, step: "a" }));
      sink.emit(finished({ title: "flaky", status: "failed", step: "a" }));
      sink.emit(retrying({ title: "Eventually green" }));
      sink.emit(started({ title: "flaky", step: "b" }));
      sink.emit(finished({ title: "flaky", step: "b" }));
      sink.emit(flowDone({ title: "Eventually green" }));
    });

    expect(xml).not.toContain("<failure ");
    expect(xml).toContain('<testsuites tests="1" failures="0"');
  });

  /** XML a reader chokes on is worse than no report: escape both places. */
  it("escapes the message and the body", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Odd & <ends>"));
      sink.emit(started({ title: "Quote", step: "a" }));
      sink.emit(raised({ problem: AWKWARD, step: "a" }));
      sink.emit(finished({ title: "Quote", status: "failed", step: "a" }));
    });

    expect(xml).toContain('classname="Odd &amp; &lt;ends&gt;"');
    expect(xml).toContain("&lt;b&gt; &amp; &quot;quoted&quot; to equal 3 &gt; 2");
    expect(xml).not.toMatch(/<b>/);
  });

  /**
   * XML 1.0 forbids an ESC byte outright and normalises a newline in an attribute
   * to a space, and `fail "${output}"` from a coloured CLI carries both.
   */
  it("keeps a control character and a newline from breaking the document", () => {
    const xml = junit((sink) => {
      sink.emit(flow("Checkout"));
      sink.emit(started({ title: "Charge", step: "a" }));
      sink.emit(raised({ problem: COLOURED, kind: "failure", step: "a" }));
      sink.emit(finished({ title: "Charge", status: "failed", step: "a" }));
    });

    expect(xml).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
    expect(xml).toContain('message="\\u001B[31mgot 404\\u001B[0m&#10;expected 200"');
    expect(xml).toContain("help  run \\u001B[1mvenn test\\u001B[0m again");
  });
});

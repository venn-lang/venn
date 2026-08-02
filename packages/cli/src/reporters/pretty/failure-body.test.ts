import { createTestHost } from "@venn-lang/contracts";
import { createFakeClient } from "@venn-lang/http";
import { describe, expect, it, vi } from "vitest";
import { runFile } from "../../run/run-file.js";
import type { Reporter } from "../reporter.types.js";
import { createPrettyReporter } from "./pretty-reporter.js";

const RECONCILE = `module demo.diff
import { equals } from "venn/assert"

flow "Reconcile" {
  step "Check the row" {
    let want = { id: "ord_8812", status: "paid", total: 99.0 }
    let row = { id: "ord_8812", status: "pending", total: 99.0 }
    expect row equals want
  }
}`;

const MEMBERSHIP = `module demo.diff
import { contains } from "venn/assert"

flow "Membership" {
  step "Look for the pair" {
    let ids = [[1, 2], [3, 4]]
    let want = [5, 6]
    expect ids contains want
  }
}`;

/** Everything the reporter writes, line by line. */
async function render(source: string): Promise<string[]> {
  const chunks: string[] = [];
  const spy = spyStdout(chunks);
  const reporter = createPrettyReporter();
  try {
    await runInto(reporter, source);
    reporter.finish({ passed: 0, failed: 1, files: 1, ms: 4 });
  } finally {
    spy.mockRestore();
  }
  return chunks.join("").split("\n");
}

/** The real parse, the real runner, the whole stdlib. Only the network is fake. */
async function runInto(reporter: Reporter, source: string): Promise<void> {
  await runFile({
    source,
    uri: "memory://diff.vn",
    host: createTestHost(),
    sink: reporter.sink,
    httpClient: createFakeClient({ responses: {} }),
  });
}

function spyStdout(chunks: string[]): { mockRestore(): void } {
  return vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
}

describe("a failed assertion, from flow to terminal", () => {
  it("carries the two maps as a field-by-field body, not as [object Object]", async () => {
    const lines = await render(RECONCILE);

    expect(lines.join("\n")).not.toContain("[object Object]");
    // The subject as the flow spelled it heads the tree.
    expect(lines).toContain("     row");
    expect(lines).toContain('     ├ .id      same      "ord_8812"');
    expect(lines).toContain('     ├ .status  expected  "paid"');
    expect(lines).toContain('     │          actual    "pending"');
    expect(lines).toContain("     └ .total   same      99");
  });

  it("shows a membership failure as the two sides whole, not as a field-by-field match", async () => {
    const lines = await render(MEMBERSHIP);

    // `contains` held one needle against every item; there is no item 0 that was
    // ever supposed to be 5, so no line may claim one.
    expect(lines.some((line) => line.includes("[0]"))).toBe(false);
    expect(lines).toContain("     expected  [5, 6]");
    expect(lines).toContain("     actual    [[1, 2], [3, 4]]");
  });
});

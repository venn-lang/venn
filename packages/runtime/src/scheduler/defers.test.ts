import { createTestHost } from "@venn-lang/contracts";
import type { Envelope } from "@venn-lang/core";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";
import { createCleanupList } from "./create-cleanup-list.js";

/**
 * Cleanup is the code that must run on every path.
 *
 * One flaky `close` used to strand every cleanup written before it, so the
 * database stayed open, and it replaced the failure that started the unwind, so
 * the reader was sent to the wrong file.
 */
const IN_A_STEP = `flow "F" {
  step "s" {
    defer { log "DEFER 1: closing the database" }
    defer { fail "DEFER 2 could not close the socket" }
    defer { log "DEFER 3: closing the file" }
    fail "the body itself failed"
  }
}`;

const AT_THE_TOP = `defer { log "TOP 1: closing the database" }
defer { fail "TOP 2 could not close the socket" }
defer { log "TOP 3: closing the file" }
log "body ran"`;

function said(events: readonly Envelope[]): string {
  return JSON.stringify(events);
}

const EVERY_ONE = [
  "DEFER 3: closing the file",
  "DEFER 2 could not close the socket",
  "DEFER 1: closing the database",
  "the body itself failed",
  "VN7004",
];

describe("three defers in a step, where the middle one fails", () => {
  it("runs all three, and still reports what started the unwind", async () => {
    const sink = createMemorySink();

    await createRunner({ host: createTestHost(), plugins: [], sink }).run(parse(IN_A_STEP).ast);
    const text = said(sink.envelopes);

    expect(EVERY_ONE.filter((one) => !text.includes(one))).toEqual([]);
  });
});

describe("three defers at the top of a script, where the middle one fails", () => {
  // Reported where it failed, and handed back to whoever is leaving, which is
  // what stops a script that could not give the socket back from exiting 0.
  it("runs all three, and hands the failure to the host", async () => {
    const sink = createMemorySink();
    const cleanup = createCleanupList();
    const runner = createRunner({ host: createTestHost(), plugins: [], sink, cleanup });

    await runner.script(parse(AT_THE_TOP).ast);
    const failures = await cleanup.close();

    expect(said(sink.envelopes)).toContain("TOP 1: closing the database");
    expect(failures).toHaveLength(1);
  });
});

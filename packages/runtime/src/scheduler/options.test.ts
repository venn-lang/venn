import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/**
 * What the checker could not know, the runtime still refuses.
 *
 * `onError` was compared against the one literal `"cancel"`, so every other
 * string, a typo included, behaved as `collect`: one wrong letter inverted the
 * semantics of a block that decides whether a failed run keeps working.
 */
const FROM_A_NAME = `flow "F" {
  const asked = "collct"
  parallel { onError: asked } {
    step "a" { log "a" }
  }
}`;

/**
 * A spread had no written key to look up, so `{ ...defaults }` contributed
 * nothing at all and only a stopwatch would have found it.
 */
const FROM_A_SPREAD = `flow "F" {
  const defaults = { onError: "collct" }
  parallel { ...defaults } {
    step "a" { log "a" }
  }
}`;

async function said(source: string): Promise<string> {
  const sink = createMemorySink();
  await createRunner({ host: createTestHost(), plugins: [], sink }).run(parse(source).ast);
  return JSON.stringify(sink.envelopes);
}

describe("an option value only the runtime can see", () => {
  it("is refused where it is read, in the same words the checker uses", async () => {
    expect(await said(FROM_A_NAME)).toContain("is not a onError this understands");
  });

  it("is refused when it arrived by spread, which used to be dropped in silence", async () => {
    expect(await said(FROM_A_SPREAD)).toContain("is not a onError this understands");
  });
});

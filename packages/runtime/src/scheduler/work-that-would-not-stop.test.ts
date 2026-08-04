import { createSystemClock, createTestHost } from "@venn-lang/contracts";
import type { Envelope } from "@venn-lang/core";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/**
 * What the language cannot stop, said out loud.
 *
 * An action that ignores the `ctx.signal` it was handed is outside anyone's
 * reach. A scope that waited for it would be the hang cancellation exists to
 * prevent, so it waits the grace, leaves, and reports `VN8002` naming what is
 * still running. These runs therefore take the grace and no longer.
 */
function harness(): { release: () => void; plugin: PluginDefinition } {
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const actions = [
    defineAction({ name: "record", run: () => {} }),
    // Deliberately takes no notice of `ctx.signal`, which is the whole case.
    defineAction({ name: "stubborn", run: () => gate }),
  ];
  return {
    release,
    plugin: definePlugin({ name: "@t/stop", version: "0", namespace: "t", actions }),
  };
}

async function ran(source: string, plugin: PluginDefinition): Promise<readonly Envelope[]> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  const host = createTestHost({ clock: createSystemClock() });
  await createRunner({ host, plugins: [plugin], sink }).run(ast);
  return sink.envelopes;
}

const STUBBORN_STEP = `flow "F" {
  @timeout(20ms)
  step "stubborn" { t.stubborn }
}`;

describe("a step that ran out of time and would not stop", () => {
  it("is reported as still running, not as a verdict over it", { timeout: 30_000 }, async () => {
    const t = harness();
    const events = await ran(STUBBORN_STEP, t.plugin);
    t.release();

    expect(JSON.stringify(events)).toContain("VN8002");
    expect(JSON.stringify(events)).toContain("did not stop");
  });
});

const STUBBORN_LOSER = `flow "F" {
  race {
    step "fast" { t.record }
    step "slow" { t.stubborn }
  }
}`;

describe("a race whose losing branch would not stop", () => {
  it("says which branch is still running before it reports the race", async () => {
    const t = harness();
    const events = await ran(STUBBORN_LOSER, t.plugin);
    t.release();

    expect(JSON.stringify(events)).toContain("a losing branch did not stop");
  });
});

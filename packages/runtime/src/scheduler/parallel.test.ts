import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner, type RunResult } from "../run/index.js";

/** A plugin that records what ran, can fail on demand, and can park. */
function harness() {
  const seen: string[] = [];
  let inFlight = 0;
  let peak = 0;
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const plugin = definePlugin({
    name: "@t/m",
    version: "0",
    namespace: "t",
    actions: [
      // Parks until released, or until the branch is cancelled. An action that
      // ignores `ctx.signal` cannot be cancelled, and that is the contract.
      defineAction({
        name: "gate",
        run: (ctx) =>
          new Promise<void>((resolve, reject) => {
            void gate.then(resolve);
            ctx.signal?.addEventListener("abort", () => reject(new Error("cancelled")));
          }),
      }),
      defineAction({
        name: "record",
        run: (_ctx, input) => {
          seen.push(String(input.args[0]));
        },
      }),
      defineAction({
        name: "boom",
        run: (_ctx, input) => {
          throw new Error(String(input.args[0]));
        },
      }),
      defineAction({
        name: "hold",
        run: async (_ctx, input) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 5));
          inFlight -= 1;
          seen.push(String(input.args[0]));
        },
      }),
    ],
  });
  return { seen, plugin, release, peak: () => peak };
}

/** What one run of a `parallel` block left behind: its verdict and its stream. */
interface Ran {
  result: RunResult;
  sink: MemorySink;
}

async function run(source: string, plugin: PluginDefinition): Promise<Ran> {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const sink = createMemorySink();
  const runner = createRunner({ host: createTestHost(), plugins: [plugin], sink });
  return { result: await runner.run(ast), sink };
}

const TWO_THAT_FAIL = `flow "F" {
  parallel { onError: "collect" } {
    step "one" { t.boom "first" }
    step "two" { t.boom "second" }
  }
}`;

describe("parallel", () => {
  /**
   * A limit the reader wrote has to bind, or `{ concurrency: 4 }` is an option
   * that parses and means nothing.
   */
  it("honours the concurrency it is given", async () => {
    const t = harness();
    await run(
      `flow "F" {
  parallel { concurrency: 2 } {
    step "a" { t.hold "a" }
    step "b" { t.hold "b" }
    step "c" { t.hold "c" }
    step "d" { t.hold "d" }
  }
}`,
      t.plugin,
    );

    expect(t.peak()).toBe(2);
    expect(t.seen).toHaveLength(4);
  });

  it("runs everything at once when no limit is given", async () => {
    const t = harness();
    await run(
      `flow "F" {
  parallel {
    step "a" { t.hold "a" }
    step "b" { t.hold "b" }
    step "c" { t.hold "c" }
  }
}`,
      t.plugin,
    );

    expect(t.peak()).toBe(3);
  });

  /**
   * `Promise.all` rejects at the first failure and leaves the siblings running:
   * a run that has already failed kept making requests, and the branch finished
   * after the flow that owned it.
   */
  it("cancels the siblings when a branch fails", async () => {
    const t = harness();
    const flow = `flow "F" {
  parallel {
    step "boom" { t.boom "no" }
    step "slow" {
      t.gate
      t.record "slow"
    }
  }
}`;
    await run(flow, t.plugin);
    t.release();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(t.seen).toEqual([]);
  });

  it("lets them all finish when asked to collect", async () => {
    const t = harness();
    await run(
      `flow "F" {
  parallel { onError: "collect" } {
    step "boom" { t.boom "no" }
    step "ok" { t.record "ok" }
  }
}`,
      t.plugin,
    );

    expect(t.seen).toEqual(["ok"]);
  });

  /**
   * Two branches failed, and the run has to say two.
   *
   * They used to be gathered into an `AggregateError` that nothing in the repo
   * ever unpacked, so the flow boundary counted the bundle once and the second
   * message reached no reporter at all.
   */
  it("reports every failure it collected, and counts them one each", async () => {
    const t = harness();
    const { result, sink } = await run(TWO_THAT_FAIL, t.plugin);

    expect(result.failed).toBe(2);
    const said = sink.envelopes.flatMap((e) => ("problem" in e.data ? [e.data.problem.title] : []));
    expect([...said].sort()).toEqual(["first", "second"]);
    expect(sink.envelopes.at(-1)?.data).toMatchObject({ failed: 2 });
  });
});

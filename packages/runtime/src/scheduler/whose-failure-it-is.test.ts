import { createTestHost } from "@venn-lang/contracts";
import { type Envelope, parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/** A verb that fails with whatever it was told to say. */
const plugin = definePlugin({
  name: "@t/pay",
  version: "0",
  namespace: "t",
  actions: [
    defineAction({
      name: "boom",
      run: (_ctx, input) => {
        throw new Error(String(input.args[0]));
      },
    }),
  ],
});

async function ran(source: string): Promise<MemorySink> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  await createRunner({ host: createTestHost(), plugins: [plugin], sink }).run(ast);
  return sink;
}

/** Which step each run of a step was, by the identity its envelopes carry. */
function titleByStep(sink: MemorySink): Map<string | undefined, string> {
  const pairs = sink.envelopes
    .filter((envelope) => envelope.kind === "step.started")
    .map((envelope): [string | undefined, string] => [
      envelope.step,
      "title" in envelope.data ? envelope.data.title : "",
    ]);
  return new Map(pairs);
}

function failures(sink: MemorySink): Envelope[] {
  return sink.envelopes.filter((envelope) => envelope.kind === "failure");
}

/**
 * A failure belongs to the step it happened in.
 *
 * Reported at the flow boundary it arrived after the step had closed, so the
 * reporter attributed it to whatever came next, or to nothing at all. The step
 * hands its body an emitter that stamps its identity, which is what makes the
 * attribution structural: two steps under a `parallel` are open at once by
 * design, and no arrival order can tell them apart.
 */
describe("a failure raised inside a step", () => {
  it("carries the step it happened in", async () => {
    const sink = await ran(`flow "F" {
  step "charge" { fail "the card was declined" }
}`);

    const [failure] = failures(sink);
    expect(failure).toBeDefined();
    expect(titleByStep(sink).get(failure?.step)).toBe("charge");
  });

  it("gives two steps open at once their own, one each", async () => {
    const sink = await ran(`flow "F" {
  parallel { onError: "collect" } {
    step "charge" { t.boom "the card was declined" }
    step "ship" { t.boom "the warehouse said no" }
  }
}`);

    const titles = titleByStep(sink);
    const owners = failures(sink).map((envelope) => titles.get(envelope.step));
    expect([...owners].sort()).toEqual(["charge", "ship"]);
    const said = failures(sink).map((envelope) => {
      if (!("problem" in envelope.data)) return "";
      return `${titles.get(envelope.step)}: ${envelope.data.problem.title}`;
    });
    expect([...said].sort()).toEqual([
      "charge: the card was declined",
      "ship: the warehouse said no",
    ]);
  });

  /** A hook runs outside every step, and saying it was in one would be a lie. */
  it("leaves a failure raised outside any step unattributed", async () => {
    const sink = await ran(`setup { fail "the fixture was missing" }

flow "F" {
  step "s" { expect true }
}`);

    expect(failures(sink).map((envelope) => envelope.step)).toEqual([undefined]);
  });
});

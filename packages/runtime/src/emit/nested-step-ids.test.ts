import { createTestHost } from "@venn-lang/contracts";
import { type Envelope, type EventKind, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

async function ran(source: string): Promise<MemorySink> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  await createRunner({ host: createTestHost(), plugins: [], sink }).run(ast);
  return sink;
}

function of(sink: MemorySink, kind: EventKind): Envelope[] {
  return sink.envelopes.filter((envelope) => envelope.kind === kind);
}

/**
 * Each step event as the pair a reporter keys on: its title and its id.
 *
 * A sorted list of ids says nothing here. Four steps all reported under one id
 * sort equal to four under their own, which is exactly how this went unnoticed,
 * so the title travels with the id and the order is the order it arrived in.
 */
function pairs(sink: MemorySink, kind: EventKind): [string, string | undefined][] {
  return of(sink, kind).map((envelope) => [
    "title" in envelope.data ? envelope.data.title : "",
    envelope.step,
  ]);
}

/**
 * A fragment is the language's unit of reuse, so its steps are the common way to
 * reach a step through another step. `expect.soft` rather than a hard one on
 * purpose: what is under test is attribution, and every step has to reach its
 * own end for there to be four of them to attribute.
 */
const FRAGMENT_IN_A_STEP = `fragment login() {
  step "enter credentials" { log "typing" }
  step "submit" { expect.soft false }
}

flow "F" {
  step "sign in" { run login() }
  step "after" { expect true }
}`;

/**
 * A step reached through another step is still its own step.
 *
 * The emitter a step hands its body used to drop an id the envelope already
 * carried and stamp its own, so every event from a fragment's steps arrived
 * under the id of the step that ran the fragment. Both reporters key open steps
 * by id: `pretty` lost the outer step's buffered lines and `junit` wrote the
 * outer step as a `<testcase>` with no `<failure>`, green, while its own
 * `step.finished` said `failed`.
 */
describe("a step inside a step", () => {
  it("opens under an id of its own, one per run", async () => {
    const sink = await ran(FRAGMENT_IN_A_STEP);

    expect(pairs(sink, "step.started")).toEqual([
      ["sign in", "s1"],
      ["enter credentials", "s2"],
      ["submit", "s3"],
      ["after", "s4"],
    ]);
  });

  it("closes under the id it opened, not the one it was reached through", async () => {
    const sink = await ran(FRAGMENT_IN_A_STEP);
    const started = pairs(sink, "step.started");

    // Paired by title rather than by position: the inner steps close before the
    // step that ran them, so the two orders are not the same order.
    expect(new Map(pairs(sink, "step.finished"))).toEqual(new Map(started));
    expect(new Set(started.map(([, step]) => step)).size).toBe(4);
  });

  it("attributes what the innermost step said to the innermost step", async () => {
    const sink = await ran(FRAGMENT_IN_A_STEP);

    expect(of(sink, "log").map((envelope) => envelope.step)).toEqual(["s2"]);
    expect(of(sink, "expect.soft_failed").map((envelope) => envelope.step)).toEqual(["s3"]);
  });
});

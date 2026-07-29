import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";
import type { RunFilter } from "./filter.types.js";

/** The titles reported, in the order they were reported. */
async function titles(source: string, filter: RunFilter = {}): Promise<string[]> {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const sink = createMemorySink();
  const runner = createRunner({ host: createTestHost(), plugins: [], sink, filter });
  await runner.run(ast);
  return sink.envelopes
    .filter((envelope) => envelope.kind === "step.started")
    .map((envelope) => (envelope.data as { title: string }).title);
}

describe("what a step is reported as", () => {
  /**
   * The case this was opened for. Every iteration used to report under the same
   * title, so a failing run named the step that broke and left you to work out
   * which pass it was.
   */
  it("fills a placeholder from the value the iteration is on", async () => {
    const source = `const names = ["ana", "bo"]

flow "F" {
  forEach name in names {
    step "add \${name}" { expect true }
  }
}`;

    expect(await titles(source)).toEqual(["add ana", "add bo"]);
  });

  it("leaves a title with no placeholder alone", async () => {
    const source = `flow "F" {
  step "plain" { expect true }
}`;

    expect(await titles(source)).toEqual(["plain"]);
  });

  it("reads whatever the scope holds, not just a loop variable", async () => {
    const source = `const user = { name: "ana" }

flow "F" {
  step "greet \${user.name}" { expect true }
}`;

    expect(await titles(source)).toEqual(["greet ana"]);
  });

  it("fills more than one placeholder", async () => {
    const source = `const a = 1
const b = 2

flow "F" {
  step "\${a} and \${b}" { expect true }
}`;

    expect(await titles(source)).toEqual(["1 and 2"]);
  });

  /**
   * A title is written before the step runs and names something that may not be
   * there. Failing the step over its own title would be a worse answer than a
   * gap in it.
   */
  it("fills a placeholder that names nothing as empty, rather than failing", async () => {
    const source = `flow "F" {
  step "add \${missing}" { expect true }
}`;

    expect(await titles(source)).toEqual(["add "]);
  });

  /**
   * `--step` matches what the reporter prints, because that is the string
   * somebody copied out of a run to narrow it down.
   */
  it("is what --step matches against", async () => {
    const source = `const names = ["ana", "bo"]

flow "F" {
  forEach name in names {
    step "add \${name}" { expect true }
  }
}`;

    expect(await titles(source, { step: "ana" })).toEqual(["add ana"]);
  });
});

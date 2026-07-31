import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { checkDocument } from "../check/index.js";
import { createMemorySink } from "../eventsink/index.js";
import { buildRegistry } from "../registry/index.js";
import { createRunner } from "../run/create-runner.js";
import { collectFragments } from "./collect.js";

const SOURCE = `import { t as h } from "@t/m"

flow "F" {
  step "s" {
    h.noop
  }
}`;

function plugin(calls: { noop: number }) {
  return definePlugin({
    name: "@t/m",
    version: "0",
    namespace: "t",
    actions: [
      defineAction({
        name: "noop",
        run: () => {
          calls.noop += 1;
        },
      }),
    ],
  });
}

describe("use … as alias", () => {
  it("resolves an aliased namespace when running", async () => {
    const calls = { noop: 0 };
    const { ast, problems } = parse(SOURCE);
    expect(problems).toEqual([]);
    const runner = createRunner({
      host: createTestHost(),
      plugins: [plugin(calls)],
      sink: createMemorySink(),
    });

    const result = await runner.run(ast);

    expect(calls.noop).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("does not flag an aliased action in the static check", () => {
    const { ast } = parse(SOURCE);
    const registry = buildRegistry({ plugins: [plugin({ noop: 0 })], caps: createTestHost().caps });
    const fragments = new Set(collectFragments(ast).keys());

    expect(checkDocument({ document: ast, registry, fragments })).toEqual([]);
  });
});

import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

const KIT = definePlugin({
  name: "@t/kit",
  namespace: "kit",
  values: [{ name: "rate", doc: "How fast.", type: t.number, value: 42 }],
});

async function ran(source: string): Promise<string[]> {
  const out: string[] = [];
  const printer = definePlugin({
    name: "@t/io",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => void out.push(input.args.map(String).join(" ")),
      }),
    ],
  });
  const runner = createRunner({
    host: createTestHost(),
    plugins: [KIT, printer],
    sink: createMemorySink(),
  });
  await runner.script(parse(source).ast);
  return out;
}

/** A constant is a value, so it arrives however a value is asked for. */
describe("a constant a plugin publishes", () => {
  it("is read off the namespace", async () => {
    expect(await ran('import { kit } from "@t/kit"\nio.print(kit.rate)')).toEqual(["42"]);
  });

  it("is bound on its own when the import names it", async () => {
    expect(await ran('import { rate } from "@t/kit"\nio.print(rate)')).toEqual(["42"]);
  });

  it("takes the name the import gave it", async () => {
    expect(await ran('import { rate as speed } from "@t/kit"\nio.print(speed)')).toEqual(["42"]);
  });

  /** Both spellings reach one value, so neither is a copy of the other. */
  it("is the same value either way", async () => {
    const source = 'import { kit, rate } from "@t/kit"\nio.print(kit.rate == rate)';

    expect(await ran(source)).toEqual(["true"]);
  });

  /** The checker is what refuses this; here it reads as the one nothing. */
  it("is not in scope for a file that did not name it", async () => {
    expect(await ran('import { kit } from "@t/kit"\nio.print(rate)')).toEqual(["null"]);
  });
});

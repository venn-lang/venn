import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

const NEWLINE = String.fromCharCode(10);

async function ran(lines: string[]): Promise<string[]> {
  const out: string[] = [];
  const plugin = definePlugin({
    name: "@t/io",
    version: "0",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => void out.push(input.args.map(String).join(" ")),
      }),
      defineAction({
        name: "boom",
        run: () => {
          throw new Error("the door was locked");
        },
      }),
    ],
  });
  const runner = createRunner({
    host: createTestHost(),
    plugins: [plugin],
    sink: createMemorySink(),
  });
  await runner.script(parse(lines.join(NEWLINE)).ast);
  return out;
}

/**
 * `try` where a value is wanted.
 *
 * The statement form recovers where steps run, so the shape a program actually
 * wants, "try this, and if it fails use that", could only be written by binding
 * before the `try` and assigning inside it.
 */
describe("trying for a value", () => {
  it("hands back the fallback when the attempt fails", async () => {
    const lines = ["const port = try io.boom() else 8080", "io.print(port)"];

    expect(await ran(lines)).toEqual(["8080"]);
  });

  it("hands back the attempt when it works", async () => {
    expect(await ran(["io.print(try 1 + 1 else 0)"])).toEqual(["2"]);
  });

  it("names the failure, and reads its message", async () => {
    const lines = ["const said = try io.boom() catch e => e.message", "io.print(said)"];

    expect(await ran(lines)).toEqual(["the door was locked"]);
  });

  it("stands in for a value inside a fragment, where there is no statement form", async () => {
    const lines = [
      "fragment show(user) {",
      '  const parts = try user.name.split(" ") else ["nobody"]',
      "  io.print(parts[0])",
      "}",
      "run show(null)",
      'run show({ name: "ana lima" })',
    ];

    expect(await ran(lines)).toEqual(["nobody", "ana"]);
  });

  /** Every failure read `VN7000`, because the code sits inside the problem. */
  it("carries the code the failure was raised with", async () => {
    const lines = ["const code = try [1].missing() catch e => e.code", "io.print(code)"];

    expect(await ran(lines)).toEqual(["VN3013"]);
  });
});

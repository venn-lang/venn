// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

/** A plugin that records what a script printed, so the answer is observable. */
function recorder(out: string[]) {
  return definePlugin({
    name: "@t/io",
    version: "0",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => void out.push(input.args.map(String).join(" ")),
      }),
    ],
  });
}

async function runScript(source: string): Promise<string[]> {
  const out: string[] = [];
  const runner = createRunner({
    host: createTestHost(),
    plugins: [recorder(out)],
    sink: createMemorySink(),
  });
  await runner.script(parse(`${source}\n`).ast);
  return out;
}

/**
 * The same lines, run in the two places the language compiles them.
 *
 * `seen` is the trace: the body appends to it, and both forms print what it ends
 * up holding. Written this way so the assertion is `top === inFn` and nothing
 * else has to be predicted.
 */
async function bothWays(body: string): Promise<{ top: string; inFn: string }> {
  const [top] = await runScript(['let seen = ""', body, "io.print seen"].join("\n"));
  const [inFn] = await runScript(
    ["fn inside() {", 'let seen = ""', body, "return seen", "}", "io.print inside()"].join("\n"),
  );
  return { top: top as string, inFn: inFn as string };
}

/**
 * A loop written at the top of a file and a loop written inside a `fn` are the
 * same loop, and have to answer the same.
 *
 * They do not share an implementation: the scheduler walks the statements a file
 * holds, while a `fn` body is compiled to steps over a frame, because a call has
 * to stay cheap and a pure body has no scheduler to ask. Two implementations of
 * one word is a place where the two can quietly disagree, and `repeat` did: it
 * counted the passes from one at the top of a file and from zero inside a `fn`.
 *
 * Both answers read as plausible, which is what made it expensive. A rota, a
 * retry count and an index into a list are all wrong by exactly one and none of
 * them look wrong. So the test is a comparison rather than an expectation: it
 * fails when the two paths drift, whichever of them moved.
 */
describe("a loop written in a fn and the same loop written at the top of a file", () => {
  it("counts the passes of a repeat from one, in both", async () => {
    const { top, inFn } = await bothWays('repeat 3 as i {\nseen = "${seen}${i} "\n}');

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 3 ");
  });

  /**
   * The pass at `n` rounded down is the last one there is room for, so a count
   * of two and a half runs twice, not three times.
   */
  it("runs the whole passes a fractional count asks for, in both", async () => {
    const { top, inFn } = await bothWays('repeat 2.5 as i {\nseen = "${seen}${i} "\n}');

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 ");
  });

  it("leaves a repeat of nothing alone, in both", async () => {
    const { top, inFn } = await bothWays('repeat 0 as i {\nseen = "${seen}${i} "\n}');

    expect(inFn).toBe(top);
    expect(top).toBe("");
  });

  it("stops a repeat where break says so, in both", async () => {
    const body = 'repeat 5 as i {\nif i == 3 { break }\nseen = "${seen}${i} "\n}';
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 ");
  });

  it("skips the pass continue skips, in both", async () => {
    const body = 'repeat 3 as i {\nif i == 2 { continue }\nseen = "${seen}${i} "\n}';
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1 3 ");
  });

  it("walks a forEach in order, and takes each item apart, in both", async () => {
    const body = 'forEach { n } in [{ n: 1 }, { n: 2 }] {\nseen = "${seen}${n} "\n}';
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 ");
  });

  it("honours break and continue inside a forEach, in both", async () => {
    const body = [
      "forEach x in [1, 2, 3, 4] {",
      "if x == 2 { continue }",
      "if x == 4 { break }",
      'seen = "${seen}${x} "',
      "}",
    ].join("\n");
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1 3 ");
  });

  /** A `break` in the inner loop leaves the inner loop, and only that one. */
  it("breaks out of the loop the break is written in, in both", async () => {
    const body = [
      "forEach x in [1, 2] {",
      "repeat 3 as i {",
      "if i == 3 { break }",
      'seen = "${seen}${x}:${i} "',
      "}",
      "}",
    ].join("\n");
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1:1 1:2 2:1 2:2 ");
  });

  it("runs an open loop until its condition stops holding, in both", async () => {
    const body = [
      "let at = 1",
      "loop at <= 3 {",
      'seen = "${seen}${at} "',
      "at = at + 1",
      "}",
    ].join("\n");
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 3 ");
  });

  it("leaves an open loop on break, in both", async () => {
    const body = [
      "let at = 1",
      "loop {",
      "if at > 3 { break }",
      'seen = "${seen}${at} "',
      "at = at + 1",
      "}",
    ].join("\n");
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 3 ");
  });
});

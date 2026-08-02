// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { createTestHost } from "@venn-lang/contracts";
import { type ProblemError, parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

const NEWLINE = String.fromCharCode(10);

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
  const [top] = await runScript(atTop(body));
  const [inFn] = await runScript(inAFn(body));
  return { top: top as string, inFn: inFn as string };
}

function atTop(body: string): string {
  return ['let seen = ""', body, "io.print seen"].join("\n");
}

function inAFn(body: string): string {
  return ["fn inside() {", 'let seen = ""', body, "return seen", "}", "io.print inside()"].join(
    "\n",
  );
}

/**
 * The same lines, refused in both places: what each refusal said.
 *
 * The spans cannot be compared whole. A compiled body is built with no document
 * behind it, so its span carries the offset, the line and the column and leaves
 * the URI empty, while the scheduler fills the URI from the engine. The column
 * is the part that says the refusal points at the same word.
 */
async function bothRefuse(body: string): Promise<{ top: Refusal; inFn: Refusal }> {
  return { top: await refusalOf(atTop(body)), inFn: await refusalOf(inAFn(body)) };
}

interface Refusal {
  code: string;
  title: string;
  help: string | undefined;
  column: number;
}

async function refusalOf(source: string): Promise<Refusal> {
  try {
    await runScript(source);
  } catch (error) {
    const { code, title, help, span } = (error as ProblemError).problem;
    return { code, title, help, column: span.column };
  }
  throw new Error(`Expected this to be refused, and it was not:\n${source}`);
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

  /**
   * `continue next` is the documented way to advance what a `loop` carries, and
   * for a while it only worked at the top of a file: inside a `fn` the value was
   * evaluated and dropped, so the state never moved and the loop never ended. A
   * hang is the worst answer a language can give, because there is nothing to
   * read, which is why the two ways of writing this loop are both here.
   */
  it("advances the state a loop carries with continue, in both", async () => {
    const body = [
      "loop n = 1 {",
      "if n > 3 { break }",
      'seen = "${seen}${n} "',
      "continue n + 1",
      "}",
    ].join("\n");
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 3 ");
  });

  it("advances it from a continue written inside an if, in both", async () => {
    const body = [
      "loop n = 1 {",
      "if n > 3 { break }",
      "if n == 2 { continue n + 1 }",
      'seen = "${seen}${n} "',
      "continue n + 1",
      "}",
    ].join("\n");
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1 3 ");
  });

  /** The value belongs to the loop that carries one, and `repeat` carries none. */
  it("drops the value a continue inside a repeat carries, in both", async () => {
    const body = [
      "loop n = 1 {",
      "if n > 3 { break }",
      "repeat 1 { continue 99 }",
      'seen = "${seen}${n} "',
      "continue n + 1",
      "}",
    ].join("\n");
    const { top, inFn } = await bothWays(body);

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 3 ");
  });

  /**
   * A bound the loop cannot use is refused rather than shrugged at. Inside a
   * `fn` these two used to pass in silence: `repeat "3"` counted three because
   * `Number` obliged, and `forEach` over a number ran no passes at all, which is
   * the checked-nothing-dressed-as-passing that `VN3015` exists to prevent.
   */
  it("refuses a repeat count that is not a number, in both", async () => {
    const { top, inFn } = await bothRefuse('repeat "3" {\nseen = "${seen}x "\n}');

    expect(inFn).toEqual(top);
    expect(top.code).toBe("VN3016");
    expect(top.title).toBe("repeat needs a number of times, and this is a string.");
  });

  it("refuses a forEach source that is not a list, in both", async () => {
    const { top, inFn } = await bothRefuse('forEach x in 5 {\nseen = "${seen}${x} "\n}');

    expect(inFn).toEqual(top);
    expect(top.code).toBe("VN3015");
    expect(top.title).toBe("forEach needs a list, and this is a number.");
  });

  it("says the same thing about a map handed to a forEach, in both", async () => {
    const { top, inFn } = await bothRefuse(
      'forEach x in { data: [1] } {\nseen = "${seen}${x} "\n}',
    );

    expect(inFn).toEqual(top);
    expect(top.help).toBe("Name the list inside it, as in `forEach item in res.data`.");
  });
});

/**
 * The two ways a `loop` carries a value forward.
 *
 * `continue next` advanced only at the top of a file and `state = next` advanced
 * only inside a `fn`, and on the wrong side neither reported anything: the loop
 * spun for ever, which is the one failure with nothing at all to read.
 *
 * Every case here counts its own passes and breaks on that count rather than on
 * the carried value. A loop guarded by the thing under test would hang the suite
 * on a regression instead of failing it, and a synchronous hang is not something
 * a timeout can interrupt: it takes the worker down on memory a minute later.
 */
describe("a loop that carries a value", () => {
  const GUARD = [
    "let passes = 0",
    "loop n = 1 {",
    "passes = passes + 1",
    "if passes > 8 { break }",
  ];

  it("advances by assignment, in both", async () => {
    const { top, inFn } = await bothWays(
      [...GUARD, "if n > 3 { break }", 'seen = "${seen}${n} "', "n = n + 1", "}"].join(NEWLINE),
    );

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 3 ");
  });

  it("advances by continue, in both", async () => {
    const { top, inFn } = await bothWays(
      [...GUARD, "if n > 3 { break }", 'seen = "${seen}${n} "', "continue n + 1", "}"].join(
        NEWLINE,
      ),
    );

    expect(inFn).toBe(top);
    expect(top).toBe("1 2 3 ");
  });

  /** The name outlives the loop and holds what the last pass left it. */
  it("leaves the state readable after the loop, in both", async () => {
    const { top, inFn } = await bothWays(
      [...GUARD, "if n > 3 { break }", "n = n + 1", "}", 'seen = "${seen}${n}"'].join(NEWLINE),
    );

    expect(inFn).toBe(top);
    expect(top).toBe("4");
  });
});

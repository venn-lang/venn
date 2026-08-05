import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createCleanupList } from "../scheduler/index.js";
import { createRunner } from "./create-runner.js";

/** A plugin that hands back a handle carrying host methods, as a real one does. */
function plugin(sink: string[]) {
  return definePlugin({
    name: "@t/io",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => {
          sink.push(input.args.map(String).join(" "));
        },
      }),
      defineAction({
        name: "open",
        run: (_ctx, input) => {
          const name = String(input.args[0] ?? "thing");
          return {
            name,
            close: () => void sink.push(`close ${name}`),
            write: (text: unknown) => void sink.push(`write ${name}: ${text}`),
          };
        },
      }),
    ],
  });
}

async function program(source: string): Promise<{ out: string[]; end: () => Promise<unknown> }> {
  const out: string[] = [];
  const cleanup = createCleanupList();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [plugin(out)],
    sink: createMemorySink(),
    cleanup,
  });
  await runner.script(parse(source).ast);
  return { out, end: () => cleanup.close() };
}

/**
 * Calling a method on what a plugin handed back.
 *
 * A handle's verbs used to be unreachable from the language: the member read
 * gave a bare host function, which nothing here could call, so the only way to
 * close anything was for the runtime to do it in TypeScript.
 */
describe("a method on a value the program holds", () => {
  it("is callable as a statement", async () => {
    const { out } = await program(['const db = io.open "db"', "db.close()"].join("\n"));

    expect(out).toEqual(["close db"]);
  });

  it("takes its arguments in brackets", async () => {
    const { out } = await program(['const db = io.open "db"', 'db.write("hello")'].join("\n"));

    expect(out).toEqual(["write db: hello"]);
  });

  it("is callable in an expression too", async () => {
    const { out } = await program(['const db = io.open "db"', "const _ = db.close()"].join("\n"));

    expect(out).toEqual(["close db"]);
  });

  /** The rule the evaluator already followed for values: a bound name wins. */
  it("lets a name the program bound beat a namespace of the same name", async () => {
    const { out } = await program(['const io = io.open "shadow"', "io.close()"].join("\n"));

    expect(out).toEqual(["close shadow"]);
  });

  it("still reports an unknown verb as one", async () => {
    await expect(program('io.nope "x"')).rejects.toThrow(/nope/);
  });
});

/**
 * `defer` at the top of a program. Inside a block it runs when the block ends;
 * a program's block is the program, and a program that serves outlives its last
 * statement, so it joins what the program gives back on the way out.
 */
describe("defer at the top of a program", () => {
  it("runs on the way out, not where it is written", async () => {
    const { out, end } = await program(
      ['const db = io.open "db"', "defer { db.close() }", 'io.print "body"'].join("\n"),
    );

    expect(out).toEqual(["body"]);
    await end();
    expect(out).toEqual(["body", "close db"]);
  });

  it("runs several in reverse, so what opened first closes last", async () => {
    const { out, end } = await program(
      [
        'const a = io.open "a"',
        "defer { a.close() }",
        'const b = io.open "b"',
        "defer { b.close() }",
      ].join("\n"),
    );

    await end();
    expect(out).toEqual(["close b", "close a"]);
  });

  /** It registers where execution reaches it, so one never reached never runs. */
  it("does not run when execution never reached it", async () => {
    const { out, end } = await program(
      ['const db = io.open "db"', "if 1 > 2 { defer { db.close() } }", 'io.print "on"'].join("\n"),
    );

    await end();
    expect(out).toEqual(["on"]);
  });
});

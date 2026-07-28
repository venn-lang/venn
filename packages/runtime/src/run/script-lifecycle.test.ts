// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test, where ${…} is the language's own interpolation.
import { createTestHost } from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createCleanupList } from "../scheduler/index.js";
import { createRunner } from "./create-runner.js";

/**
 * A plugin that records, and hands back a handle with a `close`: enough to watch
 * something open and, later, be given back.
 */
function recorder(sink: string[]) {
  return definePlugin({
    name: "@t/io",
    version: "0",
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
          sink.push(`open ${name}`);
          return { name, close: () => void sink.push(`close ${name}`) };
        },
      }),
      defineAction({
        name: "boom",
        run: () => {
          throw new Error("db is down");
        },
      }),
    ],
  });
}

/** Run a program the way a host does: the host owns the list, and closes it. */
async function program(source: string) {
  const out: string[] = [];
  const cleanup = createCleanupList();
  const events = createMemorySink();
  const runner = createRunner({
    host: createTestHost(),
    plugins: [recorder(out)],
    sink: events,
    cleanup,
    env: { RUN_ID: "r-1" },
  });
  await runner.script(parse(source).ast);
  return { out, events, end: () => cleanup.close() };
}

describe("script mode · the program's own lifetime", () => {
  it("opens what the statements open, and closes what they deferred", async () => {
    const { out, end } = await program(
      ['const db = io.open "db"', "defer { db.close() }", 'io.print "body"'].join("\n"),
    );

    expect(out).toEqual(["open db", "body"]);
    await end();
    expect(out).toEqual(["open db", "body", "close db"]);
  });

  it("runs setup before the body and teardown on the way out", async () => {
    const { out, end } = await program(
      ['setup { io.print "setup" }', 'io.print "body"', 'teardown { io.print "teardown" }'].join(
        "\n",
      ),
    );
    await end();

    expect(out).toEqual(["setup", "body", "teardown"]);
  });

  // `setup` runs before the statements, so it reads what the file *declares*,
  // its functions and `env`, not what a statement has yet to bind.
  // `teardown` runs after them, and reads everything.
  it("gives each hook what has been bound by the time it runs", async () => {
    const { out, end } = await program(
      [
        'fn label() => "db"',
        'setup { io.print "seeding ${label()} for ${env.RUN_ID}" }',
        'const opened = io.open "db"',
        'teardown { io.print "clearing ${opened.name} for ${env.RUN_ID}" }',
      ].join("\n"),
    );
    await end();

    expect(out).toEqual(["seeding db for r-1", "open db", "clearing db for r-1"]);
  });

  // The ending belongs to the host: a teardown that throws is reported and the
  // rest of it still runs, instead of taking the program's resources with it.
  it("reports a teardown that throws and still hands back what was deferred", async () => {
    const { out, events, end } = await program(
      ['const db = io.open "db"', "defer { db.close() }", "teardown { io.boom }"].join("\n"),
    );
    await end();

    expect(out).toEqual(["open db", "close db"]);
    const problems = events.envelopes
      .filter((envelope) => envelope.kind === "expect.failed")
      .map((envelope) => (envelope.data as { problem: Problem }).problem);
    expect(problems).toMatchObject([{ code: "VN7004", title: "teardown failed: db is down" }]);
  });

  // Tidying comes first: the connection `teardown` needs is one of the things
  // being closed behind it.
  it("tidies, then hands back what was deferred", async () => {
    const { out, end } = await program(
      ['const db = io.open "db"', "defer { db.close() }", 'teardown { io.print "tidy" }'].join(
        "\n",
      ),
    );
    await end();

    expect(out).toEqual(["open db", "tidy", "close db"]);
  });

  it("closes what opened later first", async () => {
    const { out, end } = await program(
      [
        'const one = io.open "one"',
        "defer { one.close() }",
        'const two = io.open "two"',
        "defer { two.close() }",
      ].join("\n"),
    );
    await end();

    expect(out).toEqual(["open one", "open two", "close two", "close one"]);
  });

  // The ending is registered before the body runs, so an interrupt halfway
  // through still finds it.
  it("still has an ending when the body never finished", async () => {
    const out: string[] = [];
    const cleanup = createCleanupList();
    const runner = createRunner({
      host: createTestHost(),
      plugins: [recorder(out)],
      sink: createMemorySink(),
      cleanup,
    });
    const source = [
      'const db = io.open "db"',
      "defer { db.close() }",
      "io.missing",
      'teardown { io.print "tidy" }',
    ];

    await expect(runner.script(parse(source.join("\n")).ast)).rejects.toThrow();
    await cleanup.close();

    expect(out).toEqual(["open db", "tidy", "close db"]);
  });
});

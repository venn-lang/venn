import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

/** A plugin that records what a script printed, so the arm taken is observable. */
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
  await runner.script(parse(source).ast);
  return out;
}

const MESSAGE = 'const m = { kind: "text", body: "oi" }\n';

describe("which arm runs", () => {
  it("is the first whose questions the subject answers", async () => {
    const source = `${MESSAGE}const said = match m {
  { kind: "ping" } => "ping"
  { kind: "text" } => "text"
  _ => "other"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["text"]);
  });

  it("is the first even when a later one would match too", async () => {
    const source = `${MESSAGE}const said = match m {
  _ => "first"
  { kind: "text" } => "second"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["first"]);
  });

  it("is a literal arm when the subject is that literal", async () => {
    const source = `const status = 404
const said = match status {
  200 => "ok"
  404 => "gone"
  _ => "other"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["gone"]);
  });

  it("is none of them when nothing matches, and the value is null", async () => {
    const source = `${MESSAGE}const said = match m {
  { kind: "ping" } => "ping"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["null"]);
  });

  it("asks about true and about nothing, as well as about text", async () => {
    const source = `const seat = { paid: true, nickname: null }
const said = match seat {
  { paid: false } => "unpaid"
  { paid: true, nickname: null } => "paid, no nickname"
  _ => "other"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["paid, no nickname"]);
  });

  it("reads a list by position", async () => {
    const source = `const pair = [1, 2]
const said = match pair {
  [1, second] => second
  _ => 0
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["2"]);
  });

  it("asks about a value further in", async () => {
    const source = `const order = { client: { plan: "pro" } }
const said = match order {
  { client: { plan: "free" } } => "free"
  { client: { plan: "pro" } } => "pro"
  _ => "other"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["pro"]);
  });
});

describe("what an arm binds", () => {
  it("hands over what the pattern named", async () => {
    const source = `${MESSAGE}const said = match m {
  { kind: "text", body } => body
  _ => "none"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["oi"]);
  });

  it("hands over the whole subject to a name", async () => {
    // Inside brackets the newlines are gone, so the arms carry commas.
    const source = `const status = 500
io.print(match status { 200 => "ok", other => "unhandled: \${other}" })`;

    expect(await runScript(source)).toEqual(["unhandled: 500"]);
  });

  /** The body is compiled, so a bound name is a slot like any other local. */
  it("hands it over inside a function body too", async () => {
    const source = `fn describe(msg) => match msg {
  { kind: "text", body } => "text: \${body}"
  { kind: "ping", at } => "ping: \${at}"
  _ => "other"
}
io.print(describe({ kind: "ping", at: 3 }))`;

    expect(await runScript(source)).toEqual(["ping: 3"]);
  });

  it("keeps two arms that name the same thing apart", async () => {
    const source = `fn take(x) => match x {
  { a: 1, held } => "a\${held}"
  { b: 2, held } => "b\${held}"
  _ => "none"
}
io.print(take({ b: 2, held: 9 }))`;

    expect(await runScript(source)).toEqual(["b9"]);
  });
});

describe("a match standing on its own", () => {
  it("runs the steps of the arm it took", async () => {
    const source = `${MESSAGE}match m {
  { kind: "ping" } {
    io.print "pong"
  }
  { kind: "text", body } {
    io.print "got"
    io.print body
  }
}`;

    expect(await runScript(source)).toEqual(["got", "oi"]);
  });

  it("runs nothing at all when no arm matches", async () => {
    const source = `${MESSAGE}match m {
  { kind: "ping" } {
    io.print "pong"
  }
}`;

    expect(await runScript(source)).toEqual([]);
  });

  it("takes an arm written with an arrow just the same", async () => {
    const source = `${MESSAGE}match m {
  { kind: "text", body } => io.print(body)
  _ => io.print("other")
}`;

    expect(await runScript(source)).toEqual(["oi"]);
  });
});

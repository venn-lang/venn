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

describe("an arm reached more than one way", () => {
  it("runs when any one of its ways matches", async () => {
    const source = `fn family(status) => match status {
  200 | 201 | 204 => "ok"
  400 | 404 => "the request"
  _ => "the server"
}
io.print(family(201))
io.print(family(404))
io.print(family(500))`;

    expect(await runScript(source)).toEqual(["ok", "the request", "the server"]);
  });

  it("binds from the way that matched", async () => {
    const source = `fn beat(m) => match m {
  { kind: "ping", at } | { kind: "pong", at } => "beat at \${at}"
  _ => "other"
}
io.print(beat({ kind: "pong", at: 9 }))`;

    expect(await runScript(source)).toEqual(["beat at 9"]);
  });

  it("runs the steps of an arm reached either way", async () => {
    const source = `match 404 {
  400 | 404 {
    io.print "the request"
  }
  _ {
    io.print "other"
  }
}`;

    expect(await runScript(source)).toEqual(["the request"]);
  });

  it("asks its guard once the way is settled", async () => {
    const source = `fn beat(m) => match m {
  { kind: "ping", at } | { kind: "pong", at } if at > 5 => "late"
  { kind: "ping", at } | { kind: "pong", at } => "early"
  _ => "other"
}
io.print(beat({ kind: "ping", at: 2 }))`;

    expect(await runScript(source)).toEqual(["early"]);
  });
});

describe("an arm with a guard", () => {
  it("runs when the condition holds", async () => {
    const source = `const said = match { n: 8 } {
  { n } if n > 5 => "big"
  _ => "small"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["big"]);
  });

  /** The point of a guard: a no moves on rather than ending the match. */
  it("passes the arm over when it does not, and tries the next", async () => {
    const source = `const said = match { n: 2 } {
  { n } if n > 5 => "big"
  { n } if n > 1 => "some"
  _ => "none"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["some"]);
  });

  it("leaves nothing at all when every guard says no", async () => {
    const source = `const said = match { n: 0 } {
  { n } if n > 5 => "big"
  { n } if n > 1 => "some"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["null"]);
  });

  it("reads what the pattern bound, not only the subject", async () => {
    const source = `const said = match { kind: "text", body: "hello" } {
  { kind: "text", body } if body.len > 3 => "long: \${body}"
  { kind: "text", body } => "short: \${body}"
  _ => "other"
}
io.print(said)`;

    expect(await runScript(source)).toEqual(["long: hello"]);
  });

  it("guards an arm that runs steps too", async () => {
    const source = `match { n: 7 } {
  { n } if n > 10 {
    io.print "over ten"
  }
  { n } if n > 5 {
    io.print "over five"
  }
  _ {
    io.print "small"
  }
}`;

    expect(await runScript(source)).toEqual(["over five"]);
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

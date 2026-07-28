import { createTestHost } from "@venn-lang/contracts";
import { AROUND_KEYS, addDecoration, nativeFn, parse } from "@venn-lang/core";
import { defineAction, type defineDecorator, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

type Decorator = ReturnType<typeof defineDecorator>;

/** A plugin whose one verb records what ran, so a rewritten program is observable. */
function recorder(seen: string[], decorators: Decorator[]) {
  return definePlugin({
    name: "@t/rec",
    version: "0",
    namespace: "rec",
    decorators,
    actions: [
      defineAction({
        name: "say",
        run: (_ctx, input) => void seen.push(input.args.map(String).join(" ")),
      }),
    ],
  });
}

async function run(source: string, decorators: Decorator[] = []) {
  const seen: string[] = [];
  const runner = createRunner({
    host: createTestHost(),
    plugins: [recorder(seen, decorators)],
    sink: createMemorySink(),
  });
  const result = await runner.run(parse(source).ast);
  return { seen, problems: result.problems ?? [] };
}

const codes = (problems: readonly { code: string }[]) => problems.map((one) => one.code);

describe("a decorator written in the language", () => {
  it("adds a parameter the decorated function was written without", async () => {
    const { seen, problems } = await run(
      [
        "deco inject(target: Fn, name: string) { target.addParam(name) }",
        '@inject("who")',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn source, not a JS template.
        'fn greet() => "hello ${who}"',
        'flow "f" { rec.say greet("world") }',
      ].join("\n"),
    );

    expect(problems).toEqual([]);
    expect(seen).toEqual(["hello world"]);
  });

  it("wraps a function and decides not to call through", async () => {
    const { seen } = await run(
      [
        "deco always(target: Fn, answer: string) { target.wrap(fn (call, args) => answer) }",
        '@always("nope")',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn source, not a JS template.
        'fn greet(who) => "hello ${who}"',
        'flow "f" { rec.say greet("world") }',
      ].join("\n"),
    );

    expect(seen).toEqual(["nope"]);
  });

  it("wraps a function and calls through, keeping what it returned", async () => {
    const { seen } = await run(
      [
        // biome-ignore-start lint/suspicious/noTemplateCurlyInString: Venn source, not a JS template.
        'deco shout(target: Fn) { target.wrap(fn (call, args) => "${call(args)}!") }',
        "@shout",
        'fn greet(who) => "hello ${who}"',
        // biome-ignore-end lint/suspicious/noTemplateCurlyInString: Venn source, not a JS template.
        'flow "f" { rec.say greet("world") }',
      ].join("\n"),
    );

    expect(seen).toEqual(["hello world!"]);
  });

  it("binds a `const` to something else", async () => {
    const { seen } = await run(
      [
        "deco force(target: Binding, other: string) { target.setValue(other) }",
        '@force("B")',
        'const greeting = "A"',
        'flow "f" { rec.say greeting }',
      ].join("\n"),
    );

    expect(seen).toEqual(["B"]);
  });

  it("takes its target out of the program", async () => {
    const { seen } = await run(
      [
        "deco off(target: Flow) { target.remove }",
        "@off",
        'flow "gone" { rec.say "gone" }',
        'flow "kept" { rec.say "kept" }',
      ].join("\n"),
    );

    expect(seen).toEqual(["kept"]);
  });

  // `@skip` has always been metadata the scheduler reads; a `deco` reaches the
  // very same channel, which is what makes `meta` worth having at all.
  it("leaves a fact the scheduler honours", async () => {
    const { seen } = await run(
      [
        'deco off(target: Flow) { target.meta "skip" true }',
        "@off",
        'flow "a" { rec.say "a" }',
        'flow "b" { rec.say "b" }',
      ].join("\n"),
    );

    expect(seen).toEqual(["b"]);
  });

  it("reads its own arguments, and the target answers with its name", async () => {
    const { seen } = await run(
      [
        'deco named(target: Flow) { target.meta "tags" [target.name] }',
        "@named",
        "@tags(other)",
        'flow "titled" { rec.say "ran" }',
      ].join("\n"),
    );

    expect(seen).toEqual(["ran"]);
  });
});

describe("what a decorator body may not do", () => {
  it("refuses a verb the kind does not have, and says what it does have", async () => {
    const { problems } = await run(
      ['deco bad(target: Flow) { target.addParam("x") }', "@bad", 'flow "f" { }'].join("\n"),
    );

    expect(codes(problems)).toContain("VN2017");
    expect(problems[0]?.title).toBe(
      "A Flow has no `addParam` — it has name, meta, remove, title, before, after.",
    );
  });

  it("refuses a plugin verb, because nothing has started yet", async () => {
    const { seen, problems } = await run(
      ['deco bad(target: Flow) { rec.say "too early" }', "@bad", 'flow "f" { }'].join("\n"),
    );

    expect(codes(problems)).toContain("VN2016");
    expect(problems[0]?.title).toContain("`rec.say`");
    expect(seen).toEqual([]);
  });

  it("refuses a signature that never says what it decorates", async () => {
    const { problems } = await run(["deco bad(target) { }", "@bad", 'flow "f" { }'].join("\n"));

    expect(codes(problems)).toEqual(["VN2015"]);
    expect(problems[0]?.title).toContain("give `target` a type");
  });

  it("refuses the decorator where its signature does not allow it", async () => {
    const { problems } = await run(
      ['deco onFns(target: Fn) { target.rename("x") }', "@onFns", 'flow "f" { }'].join("\n"),
    );

    expect(codes(problems)).toContain("VN2014");
    expect(problems[0]?.title).toBe("@onFns decorates a function, and this is a flow.");
  });
});

describe("the closures a decorator leaves around a body", () => {
  it("are run by the scheduler, on both sides, in order", async () => {
    const order: string[] = [];
    const trace = {
      name: "trace",
      expand: (ctx: { node: object }) => {
        addDecoration(
          ctx.node,
          AROUND_KEYS.before,
          nativeFn(() => order.push("before")),
        );
        addDecoration(
          ctx.node,
          AROUND_KEYS.after,
          nativeFn(() => order.push("after")),
        );
      },
    };

    const { seen } = await run('@trace\nflow "f" { rec.say "body" }', [trace as Decorator]);

    expect(seen).toEqual(["body"]);
    expect(order).toEqual(["before", "after"]);
  });
});

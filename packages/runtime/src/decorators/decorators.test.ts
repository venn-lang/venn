import { createTestHost } from "@venn-lang/contracts";
import { type ExpandContext, expand, parse, walkAst } from "@venn-lang/core";
import { defineAction, defineDecorator, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";
import { createDecoratorSource } from "./create-decorator-source.js";

/** A plugin whose verbs record what ran, so a rewritten tree is observable. */
function recorder(seen: string[], decorators: ReturnType<typeof defineDecorator>[]) {
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

async function run(source: string, decorators: ReturnType<typeof defineDecorator>[]) {
  const seen: string[] = [];
  const runner = createRunner({
    host: createTestHost(),
    plugins: [recorder(seen, decorators)],
    sink: createMemorySink(),
  });
  const result = await runner.run(parse(source).ast);
  return { seen, result };
}

describe("a plugin's own decorator", () => {
  // The point of the whole mechanism: a decorator is not a flag the runtime
  // happens to know, it is a transformation of the program.
  it("removes the node it decorates, and what it removed never runs", async () => {
    const drop = defineDecorator({ name: "drop", expand: (ctx) => ctx.remove() });
    const source = [
      'flow "kept" { rec.say "kept" }',
      "@drop",
      'flow "dropped" { rec.say "dropped" }',
    ].join("\n");

    const { seen } = await run(source, [drop]);

    expect(seen).toEqual(["kept"]);
  });

  it("puts a different node in place of the one it was written on", async () => {
    const swap = defineDecorator({
      name: "swap",
      expand: (ctx) => {
        const other = (ctx.parent as { decls?: unknown[] })?.decls?.[0];
        if (other) ctx.replace(other as never);
      },
    });
    const source = [
      'flow "first" { rec.say "first" }',
      "@swap",
      'flow "second" { rec.say "x" }',
    ].join("\n");

    const { seen } = await run(source, [swap]);

    expect(seen).toEqual(["first", "first"]);
  });

  it("reads its arguments as values, and a bare name as a word", async () => {
    const captured: unknown[][] = [];
    const note = defineDecorator({
      name: "note",
      expand: (ctx: ExpandContext) => void captured.push([...ctx.args]),
    });

    await run(["@note(2, smoke, { backoff: 500ms })", 'flow "f" { rec.say "f" }'].join("\n"), [
      note,
    ]);

    expect(captured[0]?.[0]).toBe(2);
    expect(captured[0]?.[1]).toBe("smoke");
    expect(captured[0]?.[2]).toMatchObject({ backoff: { kind: "duration", ms: 500 } });
  });

  it("refuses a program in its own words", () => {
    // A plugin picks a code in the family that matches the failure, high in the
    // range so it cannot meet a kernel one. There is no family of its own.
    const forbid = defineDecorator({
      name: "forbid",
      expand: (ctx) => ctx.reject({ code: "VN7099", title: "This flow is forbidden." }),
    });
    const { ast } = parse('@forbid\nflow "f" { }');

    const { problems } = expand({ document: ast, decorators: createDecoratorSource([]) });
    const own = expand({
      document: ast,
      decorators: { get: () => forbid, names: () => [forbid.name] },
    });

    expect(problems[0]?.code).toBe("VN2013");
    expect(own.problems).toMatchObject([{ code: "VN7099", title: "This flow is forbidden." }]);
  });

  it("is refused where it said it does not belong", () => {
    const onlyOnSteps = defineDecorator({
      name: "steppy",
      targets: ["StepDecl"],
      expand: () => {},
    });
    const { ast } = parse('@steppy\nflow "f" { }');

    const { problems } = expand({
      document: ast,
      decorators: { get: () => onlyOnSteps, names: () => [onlyOnSteps.name] },
    });

    expect(problems[0]?.code).toBe("VN2014");
    // A plugin says "StepDecl" because it is handed the raw node; the author
    // wrote `flow`, and what they are told about is the word they wrote.
    expect(problems[0]?.title).toBe("@steppy decorates a step, and this is a flow.");
    expect(problems[0]?.title).not.toContain("Decl");
  });

  /** A project is entitled to its own `@retry`; the built-ins are a stdlib. */
  it("overrides a built-in of the same name", () => {
    const mine = defineDecorator({ name: "skip", expand: () => {} });

    expect(createDecoratorSource([recorder([], [mine])]).get("skip")).toBe(mine);
  });
});

describe("the built-in decorators", () => {
  it("leave what the scheduler reads on the node", () => {
    const { ast } = parse('@tags(smoke, slow)\n@timeout(2s)\nflow "f" { }');

    expand({ document: ast, decorators: createDecoratorSource([]) });
    const flow = walkAst(ast).find((node) => node.$type === "FlowDecl") as { $meta?: object };

    expect(flow.$meta).toMatchObject({ tags: ["smoke", "slow"], timeout: 2000 });
  });
});

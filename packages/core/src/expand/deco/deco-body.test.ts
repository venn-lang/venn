import type { AstNode } from "langium";
import { describe, expect, it } from "vitest";
import { walkAst } from "../../ast/index.js";
import { parse } from "../../parse/index.js";
import type { Problem } from "../../problem/index.js";
import { expand } from "../expand.js";
import type { DecoratorSource } from "../expand.types.js";
import { readMeta } from "../node-meta.js";
import { readSignature } from "./read-signature.js";

const NO_DECORATORS: DecoratorSource = { get: () => undefined };

function run(source: string, decorators: DecoratorSource = NO_DECORATORS) {
  const ast = parse(source).ast;
  const { problems } = expand({ document: ast, decorators });
  const at = (type: string, index = 0) =>
    walkAst(ast).filter((node) => node.$type === type)[index] as AstNode;
  return { ast, problems, at };
}

const codes = (problems: readonly Problem[]) => problems.map((one) => one.code);

describe("reading what a `deco` decorates off its signature", () => {
  it("takes the first parameter as the target and the rest as arguments", () => {
    const { at } = run("deco retry(target: Flow, times: number) { }");

    expect(readSignature(at("DecoDecl") as never)).toEqual({
      ok: true,
      signature: { target: "target", kinds: ["Flow"], args: ["times"] },
    });
  });

  it("reads a union as every kind it allows", () => {
    const { at } = run("deco anywhere(target: Fn | Flow | Step) { }");

    expect(readSignature(at("DecoDecl") as never)).toMatchObject({
      signature: { kinds: ["Fn", "Flow", "Step"] },
    });
  });

  it("refuses a first parameter with no type at all", () => {
    const { problems } = run('deco bad(target) { }\n@bad\nflow "f" { }');

    expect(codes(problems)).toEqual(["VN2015"]);
    expect(problems[0]?.title).toContain("give `target` a type");
  });

  it("refuses a type that is not a kind, once, where it is written", () => {
    const { problems } = run('deco bad(target: Widget) { }\n@bad\nflow "f" { }');

    // Once: the use site did not commit the fault and must not repeat it.
    expect(codes(problems)).toEqual(["VN2015"]);
    expect(problems[0]?.title).toContain("`Widget`");
  });

  it("refuses a `deco` with no parameters", () => {
    const { problems } = run("deco bad() { }");

    expect(problems[0]?.title).toBe("`deco bad` needs a first parameter — the thing it decorates.");
  });
});

describe("running a decorator body", () => {
  it("binds its own arguments and branches on them", () => {
    const { problems, at } = run(
      [
        'deco maybe(target: Flow, when: string) { if when == "yes" { target.meta "skip" true } }',
        '@maybe("yes")',
        'flow "a" { }',
        '@maybe("no")',
        'flow "b" { }',
      ].join("\n"),
    );

    expect(problems).toEqual([]);
    expect(readMeta(at("FlowDecl", 0), "skip")).toBe(true);
    expect(readMeta(at("FlowDecl", 1), "skip")).toBeUndefined();
  });

  it("keeps a `const` of its own and reads it back", () => {
    const { problems, at } = run(
      [
        'deco tagged(target: Flow) { const tags = ["smoke"]',
        '  target.meta "tags" tags',
        "}",
        "@tagged",
        'flow "f" { }',
      ].join("\n"),
    );

    expect(problems).toEqual([]);
    expect(readMeta(at("FlowDecl"), "tags")).toEqual(["smoke"]);
  });

  it("decorates every kind its union allows", () => {
    const { problems, at } = run(
      [
        'deco both(target: Fn | Flow) { target.meta "seen" true }',
        "@both",
        "fn f() => 1",
        "@both",
        'flow "g" { }',
      ].join("\n"),
    );

    expect(problems).toEqual([]);
    expect(readMeta(at("FnDecl"), "seen")).toBe(true);
    expect(readMeta(at("FlowDecl"), "seen")).toBe(true);
  });

  it("refuses a binding that would call an action", () => {
    const { problems } = run(
      ['deco bad(target: Flow) { let page = http.get "u" }', "@bad", 'flow "f" { }'].join("\n"),
    );

    expect(codes(problems)).toEqual(["VN2016"]);
    expect(problems[0]?.title).toContain("cannot call an action");
  });

  it("refuses a verb no kind has, in the same words as one another kind has", () => {
    const { problems } = run(
      ['deco bad(target: Flow) { target.wobble "x" }', "@bad", 'flow "f" { }'].join("\n"),
    );

    expect(codes(problems)).toEqual(["VN2017"]);
    expect(problems[0]?.title).toBe(
      "A Flow has no `wobble` — it has name, meta, remove, title, before, after.",
    );
  });

  it("refuses a statement it has no way to run, and says what it does run", () => {
    const { problems } = run(
      ['deco bad(target: Flow) { step "x" { } }', "@bad", 'flow "f" { }'].join("\n"),
    );

    expect(codes(problems)).toEqual(["VN2016"]);
    expect(problems[0]?.title).toContain("`let`, `const`, `if`");
  });

  it("points a refusal at the line of the body that asked for it", () => {
    const { problems } = run(
      ["deco bad(target: Flow) {", '  rec.say "too early"', "}", "@bad", 'flow "f" { }'].join("\n"),
    );

    expect(problems[0]?.span.line).toBe(2);
  });
});

describe("where a decorator comes from", () => {
  /** The more local declaration wins, exactly as a plugin's wins over a built-in. */
  it("lets the document's own `deco` shadow one of the same name", () => {
    const fromPlugin: DecoratorSource = {
      get: (name) =>
        name === "mark" ? { name, expand: (ctx) => ctx.meta("from", "plugin") } : undefined,
    };
    const source = [
      'deco mark(target: Flow) { target.meta "from" "language" }',
      "@mark",
      'flow "f" { }',
    ];

    const { at } = run(source.join("\n"), fromPlugin);

    expect(readMeta(at("FlowDecl"), "from")).toBe("language");
  });

  it("still reaches the host's decorators for a name the document did not declare", () => {
    const fromPlugin: DecoratorSource = {
      get: (name) => ({ name, expand: (ctx) => ctx.meta("from", "plugin") }),
    };

    const { at } = run('deco mine(target: Fn) { }\n@other\nflow "f" { }', fromPlugin);

    expect(readMeta(at("FlowDecl"), "from")).toBe("plugin");
  });
});

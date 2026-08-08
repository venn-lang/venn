import type { AstNode } from "langium";
import { describe, expect, it } from "vitest";
import { walkAst } from "../../ast/index.js";
import type { Declaration } from "../../generated/ast.js";
import { parse } from "../../parse/index.js";
import type { Problem } from "../../problem/index.js";
import { expand } from "../expand.js";
import type { DecoratorSource } from "../expand.types.js";
import { readMeta } from "../node-meta.js";
import { makeHandle } from "./make-handle.js";
import { targetKindOf } from "./target-kind-of.js";

const NO_DECORATORS: DecoratorSource = { get: () => undefined, names: () => [] };

/** The two lists a decorator reads off its target, side by side. */
function signature(source: string): { params: unknown; paramTypes: unknown } {
  const node = parse(source).ast.decls[0] as Declaration;
  const handle = makeHandle({ node, kind: targetKindOf(node) });
  return { params: handle.params, paramTypes: handle.paramTypes };
}

/** A whole file, expanded, so what is asserted is what a program would get. */
function run(lines: readonly string[]) {
  const ast = parse(lines.join("\n")).ast;
  const { problems } = expand({ document: ast, decorators: NO_DECORATORS });
  const fn = walkAst(ast).find((node) => node.$type === "FnDecl") as AstNode;
  return { problems, fn };
}

describe("what a function's parameters were declared as", () => {
  it("answers one type for each name, in the order the names come", () => {
    expect(signature('fn ping(at: string, loud: bool) => "pong"')).toEqual({
      params: ["at", "loud"],
      paramTypes: ["string", "bool"],
    });
  });

  it("answers the empty text where no type was written", () => {
    expect(signature("fn ping(at, loud: bool) => 1").paramTypes).toEqual(["", "bool"]);
  });

  it("has an entry for a function nobody annotated, rather than no list", () => {
    expect(signature("fn ping(at) => 1").paramTypes).toEqual([""]);
    expect(signature("fn ping() => 1").paramTypes).toEqual([]);
  });

  it("answers a union as it was written, alternative by alternative", () => {
    expect(signature("fn ping(at: string | null) => 1").paramTypes).toEqual(["string | null"]);
  });

  it("keeps the quotes of a literal type, which is one value and not a name", () => {
    expect(signature('fn ping(method: "GET") => 1').paramTypes).toEqual(['"GET"']);
  });

  it("keeps a generic whole", () => {
    expect(signature("fn ping(tags: list<string>) => 1").paramTypes).toEqual(["list<string>"]);
  });

  /** The annotation is on the shape, and no name taken out of it is a `Call`. */
  it("stays lined up with the names a shape pattern binds", () => {
    expect(signature("fn ping({ at, loud }: Call, tries: number) => 1")).toEqual({
      params: ["at", "loud", "tries"],
      paramTypes: ["", "", "number"],
    });
  });
});

describe("a decorator reading the signature it decorates", () => {
  it("reads the types of the function it is written above", () => {
    const { problems, fn } = run([
      "deco slash(target: Fn) { const types = target.paramTypes",
      '  target.meta "options" types',
      "}",
      "@slash",
      'fn ping(at: string, loud: bool) => "pong at ${at}"',
    ]);

    expect(problems).toEqual([]);
    expect(readMeta(fn, "options")).toEqual(["string", "bool"]);
  });

  it("still refuses a verb an Fn has not got, naming the ones it has", () => {
    const { problems } = run([
      'deco bad(target: Fn) { target.wobble "x" }',
      "@bad",
      "fn ping(at: string) => 1",
    ]);

    expect(problems.map((one: Problem) => one.code)).toEqual(["VN2017"]);
    expect(problems[0]?.title).toBe(
      "A Fn has no `wobble`. It has name, meta, remove, params, paramTypes, addParam, removeParam, rename, wrap, before, after.",
    );
  });
});

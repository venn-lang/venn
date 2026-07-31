import { checkTypes, parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { createTypeCatalog } from "./create-type-catalog.js";

/**
 * A plugin whose verbs are polymorphic, which is what this exists to make
 * possible: `pick` gives back what it was given, `wrap` puts it in a list, and
 * `swap` proves two parameters stay apart.
 */
const GENERIC = definePlugin({
  name: "@t/g",
  version: "0",
  namespace: "g",
  actions: [
    defineAction({
      name: "pick",
      args: [{ name: "value", type: t.param("T"), doc: "" }],
      result: t.param("T"),
      run: (_ctx, input) => input.args[0],
    }),
    defineAction({
      name: "wrap",
      args: [{ name: "value", type: t.param("T"), doc: "" }],
      result: t.list(t.param("T")),
      run: (_ctx, input) => [input.args[0]],
    }),
    defineAction({
      name: "maybe",
      args: [{ name: "value", type: t.param("T"), doc: "" }],
      // A parameter inside a union, and inside a handle's members: the shape
      // around it must carry it through wherever it appears.
      result: t.union(t.param("T"), t.number),
      run: (_ctx, input) => input.args[0],
    }),
    defineAction({
      name: "holder",
      args: [{ name: "value", type: t.param("T"), doc: "" }],
      result: t.opaque("g.Held", { value: t.param("T"), at: t.number }),
      run: (_ctx, input) => ({ value: input.args[0], at: 0 }),
    }),
    defineAction({
      name: "swap",
      args: [
        { name: "a", type: t.param("A"), doc: "" },
        { name: "b", type: t.param("B"), doc: "" },
      ],
      result: t.list(t.param("B")),
      run: (_ctx, input) => [input.args[1]],
    }),
  ],
});

/** Check a program against the generic plugin, and return what it reported. */
function titles(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const catalog = createTypeCatalog([GENERIC]);
  return checkTypes(ast, { catalog }).problems.map((problem) => problem.title);
}

const PRELUDE = `import { g } from "@t/g"
fn takesString(s: string) -> string => s
fn takesNumber(n: number) -> number => n
`;

describe("a polymorphic signature", () => {
  it("gives back what it was given", () => {
    expect(titles(`${PRELUDE}print takesString(g.pick("a"))`)).toEqual([]);
  });

  it("refuses the argument's type used as another", () => {
    const said = titles(`${PRELUDE}print takesNumber(g.pick("a"))`);

    expect(said[0]).toContain("Type mismatch");
  });

  /**
   * The reason a signature is built per call rather than read from the cache.
   * Shared, the first call in a file would decide what `T` is for every one
   * after it.
   */
  it("is a different type in each call of the same file", () => {
    const source = `${PRELUDE}print takesString(g.pick("a"))\nprint takesNumber(g.pick(1))`;

    expect(titles(source)).toEqual([]);
  });

  it("carries the parameter into a shape around it", () => {
    const source = `${PRELUDE}fn takesStrings(xs: list<string>) -> number => xs.len
print takesStrings(g.wrap("a"))`;

    expect(titles(source)).toEqual([]);
  });

  it("refuses that shape filled with the wrong thing", () => {
    const source = `${PRELUDE}fn takesStrings(xs: list<string>) -> number => xs.len
print takesStrings(g.wrap(1))`;

    expect(titles(source)[0]).toContain("Type mismatch");
  });

  /** Two names are two types: `A` being a string says nothing about `B`. */
  it("keeps two parameters apart", () => {
    const source = `${PRELUDE}fn takesNumbers(xs: list<number>) -> number => xs.len
print takesNumbers(g.swap("a", 1))`;

    expect(titles(source)).toEqual([]);
  });

  it("carries the parameter through a union", () => {
    const source = `${PRELUDE}const kept: string | number = g.maybe("a")`;

    expect(titles(source)).toEqual([]);
  });

  it("refuses a union carrying the wrong parameter", () => {
    const source = `${PRELUDE}const kept: string | bool = g.maybe(true)`;

    expect(titles(source)[0]).toContain("Type mismatch");
  });

  it("carries the parameter into a handle's members", () => {
    const source = `${PRELUDE}const held = g.holder("a")
print takesString(held.value)`;

    expect(titles(source)).toEqual([]);
  });

  it("refuses the second parameter read as the first", () => {
    const source = `${PRELUDE}fn takesStrings(xs: list<string>) -> number => xs.len
print takesStrings(g.swap("a", 1))`;

    expect(titles(source)[0]).toContain("Type mismatch");
  });
});

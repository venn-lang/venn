import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return the titles reported. */
function titles(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => problem.title);
}

/** What a member gives back, asked by annotating it and seeing who complains. */
function says(expr: string, type: string): string[] {
  return titles(`const answer: ${type} = ${expr}`);
}

/** Every member a list has, in the order the table lists them. */
const LIST_MEMBERS = [
  "len",
  "first",
  "last",
  "reverse",
  "flatten",
  "isEmpty",
  "sum",
  "average",
  "min",
  "max",
  "toMap",
  "take",
  "drop",
  "takeLast",
  "dropLast",
  "takeWhile",
  "dropWhile",
  "distinct",
  "distinctBy",
  "sortBy",
  "minBy",
  "maxBy",
  "sumBy",
  "flatMap",
  "groupBy",
  "countBy",
  "keyBy",
  "partition",
  "chunk",
  "windows",
  "pairwise",
  "zip",
  "unzip",
  "map",
  "filter",
  "find",
  "some",
  "every",
  "forEach",
  "reduce",
  "contains",
  "indexOf",
  "join",
  "sort",
  "slice",
  "concat",
  "push",
];

describe("what a list member gives back", () => {
  /**
   * Reading a member is enough to build its type, so this asks every one of them
   * for one and fails on the first that cannot answer.
   */
  it("answers to every member the language says it has", () => {
    const source = LIST_MEMBERS.map((name, at) => `const m${at} = [1, 2].${name}`).join("\n");

    expect(titles(source)).toEqual([]);
  });

  it("takes one level off flatten, and keeps the element", () => {
    expect(says("[[1], [2]].flatten", "list<number>")).toEqual([]);
    expect(says("[[1], [2]].flatten", "list<string>")[0]).toContain(
      "expected list<string>, found list<number>",
    );
  });

  it("leaves a list that was never nested alone", () => {
    expect(says("[1, 2].flatten", "list<number>")).toEqual([]);
  });

  /** A list is one type throughout, and a union is one type. */
  it("keeps every branch of a union it flattens", () => {
    const held = `const xs: list<list<number> | list<string>> = [[1], [2]]\n`;

    expect(titles(`${held}const ys: list<number | string> = xs.flatten`)).toEqual([]);
    expect(titles(`${held}const ys: list<bool> = xs.flatten`)[0]).toContain(
      "expected list<bool>, found list<number | string>",
    );
  });

  it("groups into a map of lists", () => {
    expect(says('["a", "bb"].groupBy(w => w.len)', "map<list<string>>")).toEqual([]);
    expect(says('["a"].groupBy(w => w.len)', "map<list<number>>")[0]).toContain(
      "expected map<list<number>>, found map<list<string>>",
    );
  });

  it("counts into a map of numbers", () => {
    expect(says('["a", "bb"].countBy(w => w.len)', "map<number>")).toEqual([]);
    expect(says('["a"].countBy(w => w.len)', "map<string>")[0]).toContain(
      "expected map<string>, found map<number>",
    );
  });

  it("keys into a map of the element", () => {
    expect(says('["a", "bb"].keyBy(w => w.len)', "map<string>")).toEqual([]);
    expect(says('["a"].keyBy(w => w.len)', "map<number>")[0]).toContain(
      "expected map<number>, found map<string>",
    );
  });

  /** A list is one type throughout, so a pair holds both sides of itself. */
  it("reads pairs back into a map", () => {
    expect(says('[["a", "b"]].toMap', "map<string>")).toEqual([]);
    expect(says('[["a", "b"]].toMap', "map<number>")[0]).toContain(
      "expected map<number>, found map<string>",
    );
  });

  it("pairs one side with the other in zip", () => {
    expect(says('[1, 2].zip(["a"])', "list<list<number | string>>")).toEqual([]);
  });

  it("gives columns back from unzip", () => {
    expect(says("[[1, 2], [3, 4]].unzip", "list<list<number>>")).toEqual([]);
    expect(says("[[1]].unzip", "list<list<string>>")[0]).toContain(
      "expected list<list<string>>, found list<list<number>>",
    );
  });

  it("carries the element through a member read on it", () => {
    expect(titles('const first = ["a"].groupBy(w => w.len).values.first.first.upper')).toEqual([]);
  });
});

describe("map<V> as a type", () => {
  it("is an annotation a map satisfies, or does not", () => {
    expect(titles('const m: map<string> = { a: "x", b: "y" }')).toEqual([]);
    expect(titles("const m: map<string> = { a: 1 }")[0]).toContain(
      "expected map<string>, found { a: number }",
    );
  });

  it("says what its values hold", () => {
    expect(titles('const m: map<string> = { a: "x" }\nconst n: number = m.get("a").len')).toEqual(
      [],
    );
    const said = titles('const m: map<string> = { a: "x" }\nconst v: list<number> = m.values');

    expect(said[0]).toContain("expected list<number>, found list<string>");
  });

  it("carries what a callback gave back through mapValues", () => {
    const source =
      'const m: map<string> = { a: "x" }\nconst n: map<number> = m.mapValues(v => v.len)';

    expect(titles(source)).toEqual([]);
  });

  it("keeps the values when only the keys change", () => {
    const source =
      'const m: map<string> = { a: "x" }\nconst n: map<number> = m.mapKeys(k => k.upper)';

    expect(titles(source)[0]).toContain("expected map<number>, found map<string>");
  });

  /** A shape knows what its values are without being told twice. */
  it("reads a written shape's values the same way", () => {
    const source =
      'type P { name: string }\nconst p: P = { name: "a" }\nconst n: number = p.values.first.len';

    expect(titles(source)).toEqual([]);
  });

  it("is a map of anything when written bare", () => {
    expect(titles('const m: map = { a: 1, b: "two" }')).toEqual([]);
  });

  /** A key is a name either way, so the value is what the last argument says. */
  it("reads map<string, V> as the same type as map<V>", () => {
    expect(titles('const m: map<string, string> = { a: "x" }')).toEqual([]);
    expect(titles("const m: map<string, string> = { a: 1 }")[0]).toContain(
      "expected map<string>, found { a: number }",
    );
  });

  it("says nothing about the values of a map that named none", () => {
    expect(titles("const empty = {}\nprint empty.values")).toEqual([]);
  });

  /** `keyBy(n => n)` files under the name of the number, and this asks for it. */
  it("takes a number as the name of a key", () => {
    const source = "const m = [1, 2].keyBy(n => n)\nprint m.has(1)\nprint m.get(2)";

    expect(titles(source)).toEqual([]);
  });

  it("takes as many names as you like to pick", () => {
    expect(titles('const m: map<string> = { a: "x" }\nprint m.pick("a", "b")')).toEqual([]);
  });
});

/**
 * Members whose last argument may be left out. Reachable only now that the
 * receiver has a type at all: on `dynamic` nobody was counting.
 */
describe("a member you may call with fewer arguments", () => {
  it("pads with a space, or with what it was given", () => {
    expect(titles('print "a".padStart(3)\nprint "a".padEnd(3, ".")')).toEqual([]);
  });

  it("sorts by the natural order, or by a comparison", () => {
    expect(titles("print [2, 1].sort()\nprint [2, 1].sort((a, b) => a - b)")).toEqual([]);
  });

  it("slices to the end, or to where it was told", () => {
    expect(titles('print [1, 2, 3].slice(1)\nprint "abc".slice(1, 2)')).toEqual([]);
  });

  it("replaces with nothing, or with something", () => {
    expect(titles('print "a,b".replace(",")\nprint "a,b".replace(",", ";")')).toEqual([]);
  });

  it("rounds to whole, or to places", () => {
    expect(titles("const n = 1.234\nprint n.round()\nprint n.toFixed(2)")).toEqual([]);
  });
});

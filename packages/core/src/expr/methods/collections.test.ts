import { describe, expect, it } from "vitest";
import type { Document } from "../../generated/ast.js";
import { isLetStmt } from "../../generated/ast.js";
import { parse, parseExpression } from "../../parse/index.js";
import type { EvalEnv } from "../eval-env.types.js";
import { evaluate } from "../evaluate.js";

/** Evaluate `expr`, with any leading `const` bindings in scope. */
function run(program: string, expr: string): unknown {
  const bindings: Record<string, unknown> = {};
  const env: EvalEnv = { lookup: (name) => bindings[name] };
  for (const decl of (parse(program).ast as Document).decls) {
    if (isLetStmt(decl)) bindings[decl.name] = evaluate(decl.value, env);
  }
  const parsed = parseExpression(expr);
  if (!parsed) throw new Error(`could not parse: ${expr}`);
  return evaluate(parsed, env);
}

const PEOPLE = `const people = [
  { name: 'Ada', team: 'core', age: 36 },
  { name: 'Linus', team: 'core', age: 54 },
  { name: 'Grace', team: 'ops', age: 45 }
]`;

describe("list grouping", () => {
  it("groups items under a derived key", () => {
    const teams = run(PEOPLE, "people.groupBy(fn (p) => p.team)") as Record<string, unknown[]>;

    expect(Object.keys(teams)).toEqual(["core", "ops"]);
    expect(teams.core).toHaveLength(2);
  });

  it("counts and indexes by a key", () => {
    expect(run(PEOPLE, "people.countBy(fn (p) => p.team)")).toEqual({ core: 2, ops: 1 });
    expect(Object.keys(run(PEOPLE, "people.keyBy(fn (p) => p.name)") as object)).toEqual([
      "Ada",
      "Linus",
      "Grace",
    ]);
  });

  it("partitions into kept and rejected, in that order", () => {
    expect(run("", "[1, 2, 3, 4].partition(fn (x) => x % 2 == 0)")).toEqual([
      [2, 4],
      [1, 3],
    ]);
  });

  it("chunks, windows and zips", () => {
    expect(run("", "[1, 2, 3, 4, 5].chunk(2)")).toEqual([[1, 2], [3, 4], [5]]);
    expect(run("", "[1, 2, 3].windows(2)")).toEqual([
      [1, 2],
      [2, 3],
    ]);
    expect(run("", "[1, 2].zip(['a', 'b'])")).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
    expect(run("", "[[1, 'a'], [2, 'b']].unzip")).toEqual([
      [1, 2],
      ["a", "b"],
    ]);
  });
});

describe("list selection", () => {
  it("takes and drops from either end", () => {
    expect(run("", "[1, 2, 3, 4].take(2)")).toEqual([1, 2]);
    expect(run("", "[1, 2, 3, 4].drop(2)")).toEqual([3, 4]);
    expect(run("", "[1, 2, 3, 4].takeLast(1)")).toEqual([4]);
    expect(run("", "[1, 2, 3, 4].dropLast(1)")).toEqual([1, 2, 3]);
  });

  it("takes and drops while a predicate holds", () => {
    expect(run("", "[1, 2, 3, 1].takeWhile(fn (x) => x < 3)")).toEqual([1, 2]);
    expect(run("", "[1, 2, 3, 1].dropWhile(fn (x) => x < 3)")).toEqual([3, 1]);
  });

  it("removes duplicates, keeping the first of each", () => {
    expect(run("", "[1, 2, 2, 3, 1].distinct")).toEqual([1, 2, 3]);
    expect(run(PEOPLE, "people.distinctBy(fn (p) => p.team).len")).toBe(2);
  });

  it("sorts by a derived key rather than a comparator", () => {
    const names = run(PEOPLE, "people.sortBy(fn (p) => p.age).map(fn (p) => p.name)");

    expect(names).toEqual(["Ada", "Grace", "Linus"]);
  });

  it("finds the extremes by a score", () => {
    expect(run(PEOPLE, "people.maxBy(fn (p) => p.age).name")).toBe("Linus");
    expect(run(PEOPLE, "people.minBy(fn (p) => p.age).name")).toBe("Ada");
  });

  it("sums and averages", () => {
    expect(run("", "[1, 2, 3].sum")).toBe(6);
    expect(run("", "[1, 2, 3, 4].average")).toBe(2.5);
    expect(run(PEOPLE, "people.sumBy(fn (p) => p.age)")).toBe(135);
    expect(run("", "[].average")).toBe(0);
  });

  it("flattens as it maps", () => {
    expect(run("", "[1, 2].flatMap(fn (x) => [x, x * 10])")).toEqual([1, 10, 2, 20]);
  });
});

describe("map reshaping", () => {
  const CFG = "const cfg = { server: { host: 'local', port: 80 }, debug: true }";

  it("maps values and keys", () => {
    expect(run("", "{ a: 1, b: 2 }.mapValues(fn (v) => v * 10)")).toEqual({ a: 10, b: 20 });
    expect(run("", "{ a: 1 }.mapKeys(fn (k) => k.upper)")).toEqual({ A: 1 });
  });

  it("picks and omits by name", () => {
    expect(run(CFG, "cfg.pick('debug')")).toEqual({ debug: true });
    expect(run(CFG, "cfg.omit('server')")).toEqual({ debug: true });
  });

  it("merges deeply, keeping untouched branches", () => {
    expect(run(CFG, "cfg.mergeDeep({ server: { port: 90 } }).server")).toEqual({
      host: "local",
      port: 90,
    });
  });

  it("reads a nested path without a chain of guards", () => {
    expect(run(CFG, "cfg.getPath('server.port')")).toBe(80);
    expect(run(CFG, "cfg.getPath('server.nope')")).toBeNull();
    expect(run(CFG, "cfg.hasPath('server.host')")).toBe(true);
  });

  it("inverts keys and values", () => {
    expect(run("", "{ a: 'x' }.invert")).toEqual({ x: "a" });
  });
});

describe("string extras", () => {
  it("splits into words, lines and characters", () => {
    expect(run("", "'a b  c'.words")).toEqual(["a", "b", "c"]);
    expect(run("", "'a\\nb'.lines")).toHaveLength(2);
    expect(run("", "'ab'.chars")).toEqual(["a", "b"]);
  });

  it("changes case and makes slugs", () => {
    expect(run("", "'hello world'.capitalize")).toBe("Hello world");
    expect(run("", "'hello world'.title")).toBe("Hello World");
    expect(run("", "'João Gonçalves'.slugify")).toBe("joao-goncalves");
  });

  it("counts, matches and tests", () => {
    expect(run("", "'banana'.count('a')")).toBe(3);
    expect(run("", "'a1b22'.matches('[0-9]+')")).toEqual(["1", "22"]);
    expect(run("", "'abc'.test('^a')")).toBe(true);
  });

  it("cuts around a marker and ensures affixes", () => {
    expect(run("", "'a=b'.before('=')")).toBe("a");
    expect(run("", "'a=b'.after('=')")).toBe("b");
    expect(run("", "'x'.ensureStart('/')")).toBe("/x");
    expect(run("", "'/x'.ensureStart('/')")).toBe("/x");
  });
});

describe("number methods", () => {
  it("rounds, clamps and formats", () => {
    expect(run("", "(3.14159).round(2)")).toBe(3.14);
    expect(run("", "(99).clamp(0, 10)")).toBe(10);
    expect(run("", "(1.5).toFixed(2)")).toBe("1.50");
  });

  it("answers the everyday questions", () => {
    expect(run("", "(7).isOdd")).toBe(true);
    expect(run("", "(0 - 5).abs")).toBe(5);
    expect(run("", "(9).sqrt")).toBe(3);
    expect(run("", "(3).times")).toEqual([0, 1, 2]);
  });
});

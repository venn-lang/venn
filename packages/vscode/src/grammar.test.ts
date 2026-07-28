import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface Rule {
  match?: string;
  begin?: string;
  end?: string;
  patterns?: Rule[];
  repository?: Record<string, Rule>;
}

const PATH = fileURLToPath(new URL("../syntaxes/venn.tmLanguage.json", import.meta.url));
const grammar = JSON.parse(readFileSync(PATH, "utf8")) as Rule & {
  scopeName: string;
  repository: Record<string, Rule>;
};

/** Every regex the grammar contains, named by where it lives. */
function expressions(rules: Record<string, Rule>, prefix = ""): [string, string][] {
  const found: [string, string][] = [];
  for (const [name, rule] of Object.entries(rules)) {
    const at = `${prefix}${name}`;
    for (const key of ["match", "begin", "end"] as const) {
      if (rule[key]) found.push([`${at}.${key}`, rule[key]]);
    }
    rule.patterns?.forEach((nested, index) => {
      found.push(...expressions({ [String(index)]: nested }, `${at}.`));
    });
  }
  return found;
}

/**
 * TextMate loads a grammar all-or-nothing: one bad pattern and VS Code drops
 * the whole thing, so every `.vn` — and every code fence in a hover — turns
 * grey. Nothing in the editor says why, which is exactly why this is a test.
 */
describe("the TextMate grammar", () => {
  it("compiles every pattern it declares", () => {
    const broken = expressions(grammar.repository).filter(([, source]) => !compiles(source));

    expect(broken).toEqual([]);
  });

  it("declares every rule its pattern list includes", () => {
    const referenced = (grammar.patterns ?? [])
      .map((rule) => (rule as { include?: string }).include ?? "")
      .filter((name) => name.startsWith("#"))
      .map((name) => name.slice(1));

    expect(referenced.filter((name) => !grammar.repository[name])).toEqual([]);
  });

  it("colours the type names a hover renders", () => {
    const type = grammar.repository.type?.match ?? "";

    expect(new RegExp(type).test("list<number>")).toBe(true);
    expect(new RegExp(type).test("dynamic")).toBe(true);
  });

  it("tells a called member from a read one", () => {
    const method = new RegExp(grammar.repository.member?.match ?? "");

    expect(method.test("xs.map(")).toBe(true);
    expect(method.test("xs.len")).toBe(false);
  });

  // `deco` introduces a name, so it belongs with `fn` and `fragment` — and the
  // word boundary keeps `decorate` an ordinary identifier.
  it("colours `deco` as a declaration keyword", () => {
    const declaration = new RegExp(grammar.repository.declaration?.match ?? "");

    expect(declaration.test("deco memoize(target: Fn) {")).toBe(true);
    expect(declaration.test("decorate(x)")).toBe(false);
  });

  it("colours the `@name` that applies one", () => {
    const annotation = new RegExp(grammar.repository.annotation?.match ?? "");

    expect(annotation.test("@memoize")).toBe(true);
    expect(annotation.test("@ 2")).toBe(false);
  });
});

function compiles(source: string): boolean {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

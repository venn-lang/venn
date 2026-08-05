import { describe, expect, it } from "vitest";
import type { Document } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";
import { importedTypes } from "./imported-types.js";

/** What the checker said, code and title, with a clean parse asserted first. */
function said(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

/** The help under the first problem, which is where the way out is written. */
function helpFor(source: string): string | undefined {
  return checkTypes(parse(source).ast).problems[0]?.help;
}

const REFUSED = 'VN2018 Nothing is named "banana" here.';

/**
 * Every position the grammar lets an annotation appear, read off `venn.langium`
 * rather than off a list: `TypeRef` is reachable from a `let`, a `fn`'s params
 * and return, a `fragment`'s params and return, a `deco`'s params, a field, a
 * type alias, a generic argument, a union member and a lambda's params and
 * return. `banana?` is not among them; the grammar has no nullable suffix, and
 * the optional a reader writes is `a?: T` on a field or `T | null`.
 */
const POSITIONS: readonly (readonly [string, string])[] = [
  ["a let", 'let q: banana = "a"'],
  ["a const", 'const q: banana = "a"'],
  ["what a fn takes", "fn f(x: banana) => x"],
  ["what a fn gives back", "fn f() -> banana => 1"],
  ["what a fragment takes", "fragment g(x: banana) { print x }"],
  ["what a fragment gives back", "fragment g() -> banana { print 1 }"],
  ["a lambda's parameter", "let f = fn (x: banana) => x"],
  ["a lambda's return", "let f = fn () -> banana => 1"],
  ["an arrow's return", "let f = (x) -> banana => x"],
  ["a field of a type", "type T { a: banana }\nlet v: T = { a: 1 }"],
  ["an optional field", "type T { a?: banana }\nlet v: T = { a: 1 }"],
  ["a shape written inline", "let q: { a: banana } = { a: 1 }"],
  ["the far side of a type alias", "type A = banana\nlet v: A = 1"],
  ["a generic argument", "let q: list<banana> = [1]"],
  ["a map's value", "let m: map<string, banana> = {}"],
  ["an argument to a declared generic", "type Box<T> { v: T }\nlet b: Box<banana> = { v: 1 }"],
  ["a member of a union", 'let q: string | banana = "a"'],
  ["inside a namespace block", "namespace n { pub fn f(x: banana) => x }\nprint 1"],
];

/**
 * An annotation naming a type nothing declares.
 *
 * It used to read as `dynamic`, which accepts everything: `let q: banana = "a"`
 * printed `a` and `q.nope` answered `null`. So the annotation a reader wrote to
 * get more checking got them less of it, in silence, and every other diagnostic
 * defect leaves a reader stuck while this one leaves them believing they
 * succeeded.
 *
 * A type is a name, so this is the VN2018 an unbound value name already gets.
 * Every position is covered on purpose: a rule that holds for `let` and not for
 * a field teaches that annotations are checked, which is worse than no rule.
 */
describe("a type annotation naming nothing", () => {
  it.each(POSITIONS)("is refused as %s", (_where, source) => {
    expect(said(source)).toEqual([REFUSED]);
  });

  /** A `deco` says which kind it decorates, so VN2015 lands beside the refusal. */
  it("is refused on what a deco takes", () => {
    expect(said("deco d(x: banana) { print x }")[0]).toBe(REFUSED);
  });

  it("is refused once per written name, however often it is read", () => {
    expect(said("fn f(x: banana) => x\nlet a = f(1)\nlet b = f(2)")).toEqual([REFUSED]);
  });

  /** The one thing the old fallback got right: a wrong name is not a cascade. */
  it("leaves the binding alone rather than piling errors under it", () => {
    expect(said('let q: banana = "a"\nprint q.anything')).toEqual([REFUSED]);
  });
});

/**
 * A written name, the name it was meant to be, and the line with the suggestion
 * applied to it.
 *
 * Two questions, one suggester. A misspelling is a distance away and the
 * repository's one `nearestName` finds it. A word carried over from another
 * language is not: `text` and `string` share two letters, so no edit distance
 * that offered it would be safe on real names, and those spellings are answered
 * by name instead. The spelling search runs first, so a file that declares
 * `Text` keeps its own name.
 *
 * The third column is the point. Running a help line proves the spelling exists;
 * it does not prove the spelling fits the program that earned it, and a help
 * line is a claim bound by the same rule as a type. So the repaired source is
 * asserted to report NOTHING, which is a harder bar than parsing: advice that
 * leaves the reader on a second error of its own making has not helped.
 */
const INSTEAD: readonly (readonly [string, string, string])[] = [
  ['let r: text = "a"', "Did you mean `string`?", 'let r: string = "a"'],
  ["let z: nothing = null", "Did you mean `null`?", "let z: null = null"],
  ["let b: boolean = true", "Did you mean `bool`?", "let b: bool = true"],
  ["let n: integer = 1", "Did you mean `number`?", "let n: number = 1"],
  ["let a: array = []", "Did you mean `list`?", "let a: list = []"],
  ["let m: object = {}", "Did you mean `map`?", "let m: map = {}"],
  ["let d: any = 1", "Did you mean `dynamic`?", "let d: dynamic = 1"],
  ['let s: strng = "a"', "Did you mean `string`?", 'let s: string = "a"'],
  [
    "type Order { total: number }\nlet o: Ordr = { total: 1 }",
    "Did you mean `Order`?",
    "type Order { total: number }\nlet o: Order = { total: 1 }",
  ],
  [
    "type Text { a: number }\nlet t: text = { a: 1 }",
    "Did you mean `Text`?",
    "type Text { a: number }\nlet t: Text = { a: 1 }",
  ],
];

describe("what to write instead", () => {
  it.each(INSTEAD)("answers `%s`, and the rewrite reports nothing", (source, help, repaired) => {
    expect(helpFor(source)).toBe(help);
    expect(said(repaired)).toEqual([]);
  });

  /**
   * The brief's own row. A wrong type name and a wrong value are two mistakes,
   * and the name is refused whatever the value is: this printed `42` in silence
   * before. Applying the suggestion here leaves VN3010 about the value, which is
   * a real second mistake rather than one the advice created.
   */
  it("refuses the name whether or not the value would have fitted", () => {
    expect(said("let r: text = 42")).toEqual(['VN2018 Nothing is named "text" here.']);
    expect(said("let r: string = 42")[0]).toContain("VN3010");
  });

  /**
   * `banana` is near nothing, and the suggester refuses a guess that rewrites
   * half a name. So the help says how a type comes to exist, which is the other
   * reason this fires. Two things it may not say. Not "bind it with `const`",
   * which is what VN2018 tells a value: nobody binds a type that way. And not
   * plain `type` in the importing clause, because a reader who follows the
   * sentence in order lands on VN2009, declared there and not published.
   */
  it("says how a type comes to exist when no name is near", () => {
    expect(helpFor('let q: banana = "a"')).toBe(
      "Declare it with `type` in this file, with `pub type` in another and import " +
        "it, or use a built-in such as `string`, `number` or `bool`.",
    );
  });
});

/**
 * What stays legal, because a rule that refuses a correct program is worse than
 * the silence it replaced. A type parameter binds rather than resolves, a
 * declaration is hoisted so where it sits cannot matter, and a plugin's
 * namespace is the registry's answer rather than core's.
 */
const LEGAL: readonly (readonly [string, string])[] = [
  [
    "every type the language brings with it",
    "fn f(a: string, b: number, c: bool, d: null, e: dynamic, g: duration, h: size, " +
      "i: percent, j: instant, k: regex, l: task, m: error, n: void) => 1",
  ],
  ["a kind, which is what a deco annotates", "deco d(target: Fn) { print 1 }"],
  ["a type declared further down the file", "let v: Later = { a: 1 }\ntype Later { a: number }"],
  ["a type that names itself", "type Chain { next: Chain | null }\nlet n: Chain = { next: null }"],
  ["one type declared in terms of another below it", "type A = B\ntype B = number\nlet v: A = 1"],
  ["a generic argument", "let q: list<string> = []"],
  ["a union with null in it", "let q: string | null = null"],
  ["an optional field", "type T { a?: string }\nlet v: T = { a: null }"],
  ["a type parameter", 'type Box<T> { v: T }\nlet b: Box<string> = { v: "a" }'],
  ["a type parameter nothing uses", 'type Odd<T> { v: string }\nlet b: Odd<string> = { v: "a" }'],
  ["a namespace it cannot see inside", "let q: http.Request = 1"],
];

describe("an annotation that names something", () => {
  it.each(LEGAL)("accepts %s", (_what, source) => {
    expect(said(source)).toEqual([]);
  });
});

const ENTRY = "file:///w/main.vn";

/** The titles for the entry file, with the files around it resolved as they run. */
function acrossFiles(files: Record<string, string>): string[] {
  const modules = new Map<string, Document>();
  for (const [name, source] of Object.entries(files)) {
    const uri = `file:///w/${name}`;
    modules.set(uri, parse(source, { uri }).ast);
  }
  const resolve = (_from: string, spec: string): string => `file:///w/${spec.replace("./", "")}`;
  const document = modules.get(ENTRY) as Document;
  const imports = importedTypes({ document, uri: ENTRY, modules, resolve });
  return checkTypes(document, { uri: ENTRY, imports }).problems.map(
    (problem) => `${problem.code} ${problem.title}`,
  );
}

/** The help under the entry file's first problem, across the same files. */
function helpAcross(files: Record<string, string>): string | undefined {
  const modules = new Map<string, Document>();
  for (const [name, source] of Object.entries(files)) {
    const uri = `file:///w/${name}`;
    modules.set(uri, parse(source, { uri }).ast);
  }
  const resolve = (_from: string, spec: string): string => `file:///w/${spec.replace("./", "")}`;
  const document = modules.get(ENTRY) as Document;
  const imports = importedTypes({ document, uri: ENTRY, modules, resolve });
  return checkTypes(document, { uri: ENTRY, imports }).problems[0]?.help;
}

const LIB = { "lib.vn": "pub type User { name: string }\n" };
const FOLDER = { "shop.vn": "pub type Order { total: number }\n" };

/**
 * A type from another file, which is the case a bare-name rule gets wrong.
 *
 * `examples/language/07-folders.vn` writes `const order: shop.Order` against a
 * folder gathered by `import * as shop`, and a rule that looked the whole dotted
 * string up as one identifier refused a program that runs. The namespace arrives
 * as a record of everything the module published, so the type is a field of it.
 */
describe("a type another file declares", () => {
  it("accepts one imported by name", () => {
    const main = 'import { User } from "./lib.vn"\nconst u: User = { name: "a" }';

    expect(acrossFiles({ ...LIB, "main.vn": main })).toEqual([]);
  });

  it("accepts one read through the namespace a whole module arrived as", () => {
    const main = 'import * as shop from "./shop.vn"\nconst o: shop.Order = { total: 1 }';

    expect(acrossFiles({ ...FOLDER, "main.vn": main })).toEqual([]);
  });

  it("still checks the value against the imported shape", () => {
    const main = 'import * as shop from "./shop.vn"\nconst o: shop.Order = { total: "no" }';

    expect(acrossFiles({ ...FOLDER, "main.vn": main })[0]).toContain("VN3010");
  });
});

/** The other half: a name that really is missing, and whose mistake it is. */
describe("a type another file does not declare", () => {
  it("refuses a name the namespace does not publish", () => {
    const main = 'import * as shop from "./shop.vn"\nconst o: shop.Nope = { total: 1 }';

    expect(acrossFiles({ ...FOLDER, "main.vn": main })).toEqual([
      'VN2018 Nothing is named "shop.Nope" here.',
    ]);
  });

  /**
   * The only suggestion of mine that sits beside a delimiter, so the only one a
   * same-construct rewrite could still get wrong: the half after the dot is
   * replaced, the dot is not, and the repaired line is asserted to report
   * nothing rather than merely to parse.
   */
  it("names the half that is wrong, and the rewrite reports nothing", () => {
    const wrong = 'import * as shop from "./shop.vn"\nconst o: shop.Ordr = { total: 1 }';
    const right = 'import * as shop from "./shop.vn"\nconst o: shop.Order = { total: 1 }';

    expect(helpAcross({ ...FOLDER, "main.vn": wrong })).toBe(
      "`shop` publishes nothing called `Ordr`. Did you mean `Order`?",
    );
    expect(acrossFiles({ ...FOLDER, "main.vn": right })).toEqual([]);
  });

  /**
   * A name the import list asks for is the import's problem when the other file
   * does not publish it: VN2009 says so once, at the import, which is where the
   * mistake is. Two sentences for one mistake is what this rule must not become.
   */
  it("leaves a name the import asked for to the import", () => {
    const main = 'import { Unpublished } from "./lib.vn"\nconst u: Unpublished = { a: 1 }';

    expect(acrossFiles({ ...LIB, "main.vn": main })).toEqual([]);
  });
});

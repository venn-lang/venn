import { describe, expect, it } from "vitest";
import { isDecoDecl } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";
import { showType } from "./show.js";
import type { Type } from "./type.types.js";

function checked(source: string) {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  return checkTypes(ast);
}

const titles = (source: string): string[] => checked(source).problems.map((one) => one.title);
const codes = (source: string): string[] => checked(source).problems.map((one) => one.code);

/** The type the checker settled on for a named declaration of that kind. */
function typeOf(source: string, name: string, kind: string): string | undefined {
  for (const [node, type] of checked(source).types) {
    const decl = node as { name?: string; $type?: string };
    if (decl.$type === kind && decl.name === name) return showType(type as Type);
  }
  return undefined;
}

const RETRY = 'deco retry(target: Flow, times: number) { target.meta "retry" times }';

/**
 * `Fn`, `Flow`, `Step`, `Binding`, `Type`, `Resource` and `Node` are types,
 * published the way `http.Request` is. The point is not the names: it is that a
 * decorator's body holds something the checker, the hover and the completion
 * list can all describe without any of them learning a second vocabulary.
 */
describe("the kinds are types", () => {
  it("gives the target the handle its kind offers", () => {
    const written = typeOf('deco m(target: Fn) { target.rename "x" }', "target", "Param");

    expect(written).toContain("params: list<string>");
    expect(written).toContain("wrap: fn(");
  });

  it("carries a verb's type through into the body", () => {
    const source = ["deco m(target: Fn) {", "  const names = target.params", "}"].join("\n");

    expect(typeOf(source, "names", "LetStmt")).toBe("list<string>");
    expect(titles(source)).toEqual([]);
  });

  it("says so when a kind does not offer what the body asked for", () => {
    const source = ["deco m(target: Flow) {", "  const names = target.params", "}"].join("\n");

    expect(codes(source)).toEqual(["VN3010"]);
    expect(titles(source)[0]).toContain('has no field "params"');
  });

  /**
   * Both print as `Fn` now that a name is printed, so the name cannot be the
   * assertion: the built-in would pass it. What the file's own `Fn` has and the
   * handle does not is `arity`, and what the handle has and it does not is
   * `name`, so the two fields tell them apart where the label no longer can.
   */
  it("is a stdlib and not a reserved word, a file's own `Fn` wins", () => {
    const source = [
      "type Fn { arity: number }",
      "deco m(target: Fn) {",
      "  const n = target.arity",
      "}",
    ].join("\n");
    const shadowed = source.replace("  const n = target.arity", "  const n = target.name");

    expect(typeOf(source, "target", "Param")).toBe("Fn");
    expect(codes(source)).toEqual([]);
    expect(titles(shadowed)[0]).toContain('has no field "name"');
  });
});

/**
 * A `deco` with no target can never be applied to anything, so it is refused
 * where it is written rather than at every `@name` that reaches for it.
 */
describe("a deco's signature", () => {
  it("is reported when it declares no parameter at all", () => {
    expect(codes("deco memoize() { }")).toEqual(["VN2015"]);
    expect(titles("deco memoize() { }")[0]).toBe(
      "`deco memoize` needs a first parameter, named: the thing it decorates.",
    );
  });

  it("is reported when the target is typed with something that is not a kind", () => {
    expect(codes("deco memoize(target: string) { }")).toEqual(["VN2015"]);
    expect(titles("deco memoize(target: string) { }")[0]).toContain("which is not a kind");
  });

  it("is reported when the target carries no type to read", () => {
    expect(codes("deco memoize(target) { }")).toEqual(["VN2015"]);
  });
});

/** `@retry(3)` is a call, and gets what a call gets. */
describe("a decorator's own arguments", () => {
  it("accepts what the parameters declared", () => {
    expect(titles([RETRY, "@retry(3)", 'flow "f" { }'].join("\n"))).toEqual([]);
  });

  it("reports an argument of the wrong type", () => {
    const found = checked([RETRY, '@retry("soon")', 'flow "f" { }'].join("\n")).problems;

    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe("VN3010");
    expect(found[0]?.title).toBe("Type mismatch: expected number, found string.");
  });

  it("points at the argument, not at the whole decorator", () => {
    const source = [RETRY, '@retry("soon")', 'flow "f" { }'].join("\n");

    expect(checked(source).problems[0]?.span.offset).toBe(source.indexOf('"soon"'));
  });

  it("reports an argument that was never given", () => {
    const found = checked([RETRY, "@retry", 'flow "f" { }'].join("\n")).problems;

    expect(found[0]?.code).toBe("VN3017");
    expect(found[0]?.title).toBe("@retry takes 1 argument, and was given none.");
  });

  it("reports one argument too many", () => {
    const found = checked([RETRY, "@retry(3, 4)", 'flow "f" { }'].join("\n")).problems;

    expect(found[0]?.title).toBe("@retry takes 1 argument, and was given 2.");
  });

  it("leaves a decorator nobody declared alone", () => {
    expect(titles('@tags(smoke)\nflow "f" { }')).toEqual([]);
  });
});

/**
 * The wrong-kind refusal is what a signature exists to produce, so it belongs
 * where the file is still being written. `venn check` and the editor never
 * expand, so without this the error waits for someone to run the program. Same
 * sentence as expansion's, because both ask the same function.
 */
describe("a decorator on the wrong kind, statically", () => {
  const MEMOIZE = 'deco memoize(target: Fn) { target.meta "memo" true }';

  it("is reported without running anything", () => {
    const found = checked([MEMOIZE, "@memoize", 'flow "f" { }'].join("\n")).problems;

    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe("VN2014");
    expect(found[0]?.title).toBe("@memoize decorates a function, and this is a flow.");
  });

  it("points at the `@name`", () => {
    const source = [MEMOIZE, "@memoize", 'flow "f" { }'].join("\n");

    const span = checked(source).problems[0]?.span;

    expect(span?.offset).toBe(source.indexOf("@memoize"));
    expect(span?.length).toBe("@memoize".length);
  });

  it("accepts the kind the signature named", () => {
    expect(titles([MEMOIZE, "@memoize", "fn twice(n) => n"].join("\n"))).toEqual([]);
  });

  it("reads a union, and a `Node` that constrains nothing", () => {
    const note = 'deco note(target: Fn | Flow) { target.meta "n" true }';
    const any = 'deco tag(target: Node) { target.meta "t" true }';

    expect(titles([note, "@note", 'flow "f" { }'].join("\n"))).toEqual([]);
    expect(
      titles([note, "@note", 'flow "f" {', "@note", '  step "s" { }', "}"].join("\n")),
    ).toEqual(["@note decorates a function or a flow, and this is a step."]);
    expect(titles([any, "@tag", "type User { name: string }"].join("\n"))).toEqual([]);
  });

  /** One complaint, where the signature is written; not one at every use. */
  it("stays quiet for a `deco` whose signature never said", () => {
    expect(codes(["deco broken() { }", "@broken", 'flow "f" { }'].join("\n"))).toEqual(["VN2015"]);
  });

  it("does not go on to count arguments for a decorator that is in the wrong place", () => {
    expect(codes([MEMOIZE, "@memoize(1)", 'flow "f" { }'].join("\n"))).toEqual(["VN2014"]);
  });
});

/**
 * A decorator may change everything about what it is applied to, and the
 * checker reads the program before any of them ran. It answers `dynamic` for
 * exactly the functions that are about to change, rather than rejecting a
 * program that runs.
 */
describe("a function a decorator reshapes", () => {
  const INJECT = "deco inject(target: Fn, name: string) { target.addParam(name) }";
  const SHOUT = 'deco shout(target: Fn) { target.wrap(fn (call, args) => "loud") }';
  const TAGGED = 'deco tagged(target: Fn) { target.meta "tag" true }';

  it("takes the parameter the decorator will add", () => {
    const source = [INJECT, '@inject("who")', "fn greet(g) => g", 'const r = greet("a", "b")'];

    expect(titles(source.join("\n"))).toEqual([]);
  });

  it("takes a return the decorator will replace", () => {
    const source = [SHOUT, "@shout", "fn n(x) => 1", "const r: string = n(1)"];

    expect(titles(source.join("\n"))).toEqual([]);
  });

  it("says `dynamic`, which is what it honestly knows", () => {
    const source = [INJECT, '@inject("who")', "fn greet(g) => g"].join("\n");

    expect(typeOf(source, "greet", "FnDecl")).toBe("dynamic");
  });

  /** The relaxation is for the shape, not for the body: what is inside still counts. */
  it("still checks the body of one", () => {
    const source = [INJECT, '@inject("who")', "fn greet(g) => g + true"].join("\n");

    expect(codes(source)).toEqual(["VN3010"]);
  });

  /** A call of the wrong arity, so the count is what it is refused for. */
  it("leaves a function alone when its decorator changes no shape", () => {
    const source = [TAGGED, "@tagged", "fn one(x) => x", 'const r = one("a", "b")'];

    expect(codes(source.join("\n"))).toEqual(["VN3002"]);
  });

  it("leaves every undecorated function alone", () => {
    const source = [INJECT, "fn plain(g) => g", 'const r = plain("a", "b")'];

    expect(codes(source.join("\n"))).toEqual(["VN3002"]);
  });
});

/**
 * A decorator the file imported is a decorator the file uses, so the checker
 * has to be told about it. Without it an imported `@inject` was invisible: the
 * kind went unchecked and every call to what it reshaped was reported wrong.
 */
describe("a deco imported from another file", () => {
  const LIB = [
    "pub deco inject(target: Fn, name: string) { target.addParam(name) }",
    'pub deco off(target: Flow) { target.meta "skip" true }',
    "pub deco broken() { }",
  ].join("\n");

  function withLib(source: string) {
    const lib = parse(LIB, { uri: "/lib.vn" });
    expect(lib.problems).toEqual([]);
    const imported = new Map(
      lib.ast.decls.filter(isDecoDecl).map((decl) => [decl.name, { decl, uri: "/lib.vn" }]),
    );
    const { ast, problems } = parse(source);
    expect(problems).toEqual([]);
    return checkTypes(ast, { decos: imported });
  }

  const shown = (source: string): string[] => withLib(source).problems.map((one) => one.title);
  const found = (source: string): string[] => withLib(source).problems.map((one) => one.code);

  it("takes the parameter an imported decorator adds", () => {
    expect(
      shown(['@inject("who")', "fn greet(g) => g", 'const r = greet("a", "b")'].join("\n")),
    ).toEqual([]);
  });

  it("checks the kind an imported signature named", () => {
    expect(shown("@off\nfn f(n) => n")).toEqual(["@off decorates a flow, and this is a function."]);
  });

  it("counts the arguments an imported signature asks for", () => {
    expect(found("@inject\nfn greet(g) => g")).toEqual(["VN3017"]);
  });

  /** Its faults belong to its own file, and are reported when that one is checked. */
  it("says nothing here about an imported signature that does not read", () => {
    expect(found('@broken\nflow "f" { }')).toEqual([]);
  });
});

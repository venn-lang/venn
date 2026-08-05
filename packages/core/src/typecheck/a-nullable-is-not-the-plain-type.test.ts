import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const NEWLINE = String.fromCharCode(10);
const USER = ["type User = { name: string | null }", 'const u: User = { name: "ana" }'];

/** Every problem a source reports, as `CODE title`. */
function said(...lines: string[]): string[] {
  const source = [...USER, ...lines].join(NEWLINE);
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

/** The help under the first problem, which is where the way out is written. */
function helped(...lines: string[]): string | undefined {
  const source = [...USER, ...lines].join(NEWLINE);
  return checkTypes(parse(source).ast).problems[0]?.help;
}

/**
 * A value that may be nothing, where something was asked for.
 *
 * `unify` asks whether two types can be made equal, which a `string | null` and
 * a `string` can, by picking the member that fits. The member it leaves behind
 * is the null nobody handled, and the program only found out where it read a
 * field of nothing, far from where the null came in.
 */
describe("a nullable where the plain type was asked for", () => {
  it("is refused in a binding", () => {
    expect(said("const shown: string = u.name")[0]).toContain(
      "expected string, found string | null",
    );
  });

  it("is refused as an argument, at the argument", () => {
    const found = said("fn shout(s: string) -> string => s.upper", "const loud = shout(u.name)");

    expect(found[0]).toContain("expected string, found string | null");
  });

  it("is refused as a return", () => {
    expect(said("fn give() -> string => u.name")[0]).toContain("found string | null");
  });

  it("is refused as a field", () => {
    const found = said("type Card = { title: string }", "const card: Card = { title: u.name }");

    expect(found[0]).toContain("VN3010");
  });

  it("is refused inside a list", () => {
    expect(said("const names: list<string> = [u.name]")[0]).toContain("VN3010");
  });

  /** The other direction is the whole point of a union, and stays. */
  it("takes the plain type where the nullable was asked for", () => {
    expect(said('const held: string | null = "ana"')).toEqual([]);
  });
});

describe("the ways out", () => {
  it("takes a stand-in", () => {
    expect(said('const shown: string = u.name ?? "anon"')).toEqual([]);
  });

  it("takes a guard on the name", () => {
    const lines = ["const held = u.name", "if held != null {", "  const shown: string = held", "}"];

    expect(said(...lines)).toEqual([]);
  });

  /**
   * And on the field, which is the shape a nullable usually arrives in. A scope
   * binds names, so what is written down is the record with the field narrowed.
   */
  it("takes a guard on the field", () => {
    const lines = ["if u.name != null {", "  const shown: string = u.name", "}"];

    expect(said(...lines)).toEqual([]);
  });

  it("learns on the other side of an equality", () => {
    const lines = [
      "if u.name == null {",
      "  print 1",
      "} else {",
      "  const shown: string = u.name",
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("says which way out, under the mismatch", () => {
    expect(helped("const shown: string = u.name")).toContain("`?? …`");
  });

  /** A number where a string was wanted is a different mistake, and says nothing. */
  it("says nothing about nothing when nothing is not the fault", () => {
    expect(helped("const shown: string = 42")).toBeUndefined();
  });
});

/**
 * A branch nobody falls out of, and what stands after it.
 *
 * The guard clause deals with the nothing and leaves the rest of the body with a
 * value, which is the flat way of writing a function every language spells the
 * same. Refusing it while allowing the nested way made the shape of the code the
 * thing that decided, and the help said to ask `if x != null` first, which is
 * exactly what the program did.
 */
describe("a branch that ends the pass", () => {
  it("narrows the statements written after it", () => {
    const lines = [
      "fn afterAGuard(status: number | null) -> string {",
      "  if status == null {",
      '    return "no"',
      "  }",
      "  if status >= 200 {",
      '    return "ok"',
      "  }",
      '  return "low"',
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("narrows the expression the body ends with", () => {
    const lines = [
      "fn afterAGuard(status: number | null) -> string {",
      "  if status == null {",
      '    return "no"',
      "  }",
      '  status >= 200 ? "ok" : "low"',
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  /** `fail` ends the pass the same way, and belongs where verbs are allowed. */
  it("narrows after a guard that fails instead of returning", () => {
    const lines = [
      "fragment checkStatus(status: number | null) {",
      "  if status == null {",
      '    fail "no status"',
      "  }",
      "  const held: number = status",
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("narrows the rest of a loop after a `continue`", () => {
    const lines = [
      "fn each(xs: list<number | null>) -> number {",
      "  forEach x in xs {",
      "    if x == null {",
      "      continue",
      "    }",
      "    const held: number = x",
      "  }",
      "  return 0",
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("narrows the rest of a loop after a `break`", () => {
    const lines = [
      "fn each(xs: list<number | null>) -> number {",
      "  forEach x in xs {",
      "    if x == null {",
      "      break",
      "    }",
      "    const held: number = x",
      "  }",
      "  return 0",
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("narrows on the other side when it is the `else` that ends the pass", () => {
    const lines = [
      "fn afterAGuard(status: number | null) -> string {",
      "  if status != null {",
      "    const held: number = status",
      "  } else {",
      '    return "no"',
      "  }",
      '  return status >= 200 ? "ok" : "low"',
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  /** A guard on the field narrows the record, and the record outlives the `if`. */
  it("narrows a field the same way", () => {
    const lines = [
      "fn shout() -> string {",
      "  if u.name == null {",
      '    return "anon"',
      "  }",
      "  return u.name.upper",
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  /** An `if` both of whose sides come back says nothing about what follows. */
  it("leaves the scope alone when the branch falls through", () => {
    const lines = [
      "fn afterAnIf(status: number | null) -> string {",
      "  if status == null {",
      "    const none = 0",
      "  }",
      '  return status >= 200 ? "ok" : "low"',
      "}",
    ];

    expect(said(...lines)[0]).toContain("expected number, found number | null");
  });
});

/**
 * A `return` is a value like any other, and is read in the scope it stands in.
 * Reading it again from the body's own scope lost every narrowing the branch
 * around it had made, so the same condition worked as a statement and not as the
 * thing being handed back.
 */
describe("the value a return hands back", () => {
  it("is narrowed by the `if` it is written inside", () => {
    const lines = [
      "fn returnForm(status: number | null) -> string {",
      "  if status != null {",
      '    return status >= 200 ? "ok" : "low"',
      "  }",
      '  return "none"',
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  /** Which the statement form always allowed, and still does. */
  it("agrees with the same thing written as statements", () => {
    const lines = [
      "fn statementForm(status: number | null) -> string {",
      "  if status != null {",
      "    if status >= 200 {",
      '      return "ok"',
      "    }",
      "  }",
      '  return "none"',
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  it("is narrowed for a name bound from a field", () => {
    const lines = [
      "fn shout() -> string {",
      "  const held = u.name",
      "  if held != null {",
      "    return held.upper",
      "  }",
      '  return "anon"',
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  /** Nothing loosened: a `return` the annotation does not allow is still wrong. */
  it("is still measured against what the fn declared", () => {
    const lines = [
      "fn returnForm(status: number | null) -> string {",
      "  if status != null {",
      "    return status",
      "  }",
      '  return "none"',
      "}",
    ];

    expect(said(...lines)[0]).toContain("VN3010");
  });
});

/** A guard that has nothing to teach leaves the scope as it found it. */
describe("a guard that learns nothing", () => {
  it("says nothing about a field that was never nothing", () => {
    const lines = [
      "type Card = { title: string }",
      'const card: Card = { title: "a" }',
      "if card.title != null {",
      "  const shown: string = card.title",
      "}",
    ];

    expect(said(...lines)).toEqual([]);
  });

  /** A list has no field to narrow, and asking is not an error. */
  it("says nothing about a field of something that has none", () => {
    const lines = ["const xs = [1, 2]", "if xs.len != null {", "  print xs.len", "}"];

    expect(said(...lines)).toEqual([]);
  });

  /** Arity is its own question, on either side of it, and answered elsewhere. */
  it("leaves a call with the wrong number of arguments to the arity check", () => {
    const declared = "fn pair(a: string, b: string) -> string => a";

    expect(said(declared, 'const few = pair("x")')[0]).toContain("VN3002");
    expect(said(declared, 'const many = pair("x", "y", "z")')[0]).toContain("VN3002");
  });
});

/**
 * Four names an annotation could not read, so `: instant` resolved to no type
 * anybody declared, which is answered with `dynamic`, which takes everything.
 */
describe("the units, written as annotations", () => {
  it("check what they were given", () => {
    expect(said('const a: instant = "not a moment"')[0]).toContain("expected instant");
    expect(said("const b: duration = 42")[0]).toContain("expected duration");
    expect(said("const c: size = true")[0]).toContain("expected size");
    expect(said('const d: percent = "no"')[0]).toContain("expected percent");
  });

  it("take what they are for", () => {
    expect(
      said("const a: duration = 300ms", "const b: size = 2mb", "const c: percent = 99%"),
    ).toEqual([]);
  });
});

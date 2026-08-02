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

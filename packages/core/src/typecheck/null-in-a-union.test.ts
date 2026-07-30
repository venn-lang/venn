import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { BUILTIN_TYPES } from "./builtin-types.js";
import { checkTypes } from "./check-types.js";

/** Check a program and return what it reported, code and all. */
function said(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

describe("null written where a type goes", () => {
  it("stands in a union", () => {
    expect(said('const x: string | null = null\nconst y: string | null = "here"')).toEqual([]);
  });

  it("is checked, not merely parsed", () => {
    const said42 = said("const x: string | null = 42");

    expect(said42[0]).toContain("expected string | null, found number");
  });

  it("stands beside a shape", () => {
    expect(said("const x: { a: number } | null = null")).toEqual([]);
  });

  it("stands on its own", () => {
    expect(said("const x: null = null")).toEqual([]);
  });

  it("stands in a named type", () => {
    expect(said("type Found = string | null\nconst x: Found = null")).toEqual([]);
  });

  /** `credits?: number` has always built this type. Now it can be written. */
  it("is the type an optional field already had", () => {
    const source = `type Seat { credits?: number }
const seat: Seat = {}
const credits: number | null = seat.credits`;

    expect(said(source)).toEqual([]);
  });

  /** The hover offers this line to whoever is learning the language. */
  it("is written the way the built-in table says it is", () => {
    const source = `type Row { ${BUILTIN_TYPES.null?.example} }`;

    expect(said(source)).toEqual([]);
  });
});

describe("narrowing something that may be nothing", () => {
  it("leaves the other side with the value", () => {
    const source = `type User { name: string }
fn nameOf(u: User | null) -> string => u == null ? "nobody" : u.name`;

    expect(said(source)).toEqual([]);
  });

  it("narrows the block when the check is the other way round", () => {
    const source = `const maybe: string | null = "here"
if maybe != null {
  print maybe.upper
}`;

    expect(said(source)).toEqual([]);
  });

  it("refuses what nothing carries", () => {
    const source = `type User { name: string }
fn nameOf(u: User | null) -> string => u == null ? u.name : "x"`;

    expect(said(source)[0]).toContain('Type null has no member "name"');
  });

  it("says a value that is always there is never nothing", () => {
    const source = `const s: string = "always here"
if s == null {
  print "never"
}`;

    expect(said(source)[0]).toContain("VN3020 s is never null here");
  });

  /** Anything could turn out to be nothing, so there is nothing to say. */
  it("says nothing about a value whose type is not settled", () => {
    const source = `fn present(x) => x != null
print present(1)
print present("a")`;

    expect(said(source)).toEqual([]);
  });

  /**
   * A scope binds names, so there is nowhere to write down that one field of a
   * shape turned out to be there.
   */
  it("says nothing about a field compared to null", () => {
    const source = `type Seat { credits?: number }
const seat: Seat = {}
if seat.credits == null {
  print "none"
}`;

    expect(said(source)).toEqual([]);
  });
});

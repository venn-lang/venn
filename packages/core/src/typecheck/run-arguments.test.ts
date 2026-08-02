import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const NEWLINE = String.fromCharCode(10);

/** Every problem a source reports, as `CODE title`. */
function said(...lines: string[]): string[] {
  const { ast, problems } = parse(lines.join(NEWLINE));
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

const SHOW = ["fragment show(s: string) {", "  print s", "}"];

/**
 * What a `run` hands over.
 *
 * A `fn` called with the wrong type has been refused for as long as there have
 * been types. A `fragment` was not: `run` passed whatever it was given and the
 * parameter's annotation was read by nobody, so the one construct written to be
 * called from elsewhere was the one nothing checked.
 */
describe("running a fragment with what it does not take", () => {
  it("refuses the wrong type, at the argument", () => {
    expect(said(...SHOW, "run show(42)")[0]).toContain("expected string, found number");
  });

  it("refuses a nullable where the plain type is asked for", () => {
    const lines = [
      "type User = { name: string | null }",
      'const u: User = { name: "ana" }',
      ...SHOW,
      "run show(u.name)",
    ];

    expect(said(...lines)[0]).toContain("expected string, found string | null");
  });

  it("takes what it was declared with", () => {
    expect(said(...SHOW, 'run show("fine")')).toEqual([]);
  });
});

describe("running a fragment with the wrong number of arguments", () => {
  it("refuses too few", () => {
    expect(said(...SHOW, "run show()")[0]).toContain("`show` takes 1 argument, and 0 were given");
  });

  it("refuses too many", () => {
    expect(said(...SHOW, 'run show("a", "b")')[0]).toContain("takes 1 argument, and 2 were given");
  });

  it("counts more than one in the plural", () => {
    const pair = ["fragment pair(a: string, b: string) {", "  print a", "}"];

    expect(said(...pair, 'run pair("a")')[0]).toContain("takes 2 arguments, and 1 was given");
  });

  it("takes none where none are declared", () => {
    expect(said("fragment none() {", '  print "x"', "}", "run none()")).toEqual([]);
  });

  /** A fragment written with no parameter list at all still takes none. */
  it("refuses an argument to one that declares none", () => {
    const none = ["fragment none() {", '  print "x"', "}"];

    expect(said(...none, "run none(1)")[0]).toContain("`none` takes 0 arguments, and 1 was given");
  });
});

describe("what it still leaves alone", () => {
  /** No annotation is no claim, so anything satisfies it. */
  it("says nothing about a parameter that says nothing", () => {
    expect(said("fragment loose(x) {", "  print x", "}", "run loose(42)")).toEqual([]);
  });

  it("says nothing about a parameter written as a pattern", () => {
    const lines = [
      "type User = { name: string }",
      'const u: User = { name: "ana" }',
      "fragment taken({ name }: User) {",
      "  print name",
      "}",
      "run taken(u)",
    ];

    expect(said(...lines)).toEqual([]);
  });

  /**
   * One this file does not declare. An imported fragment is resolved by the
   * runtime, and a name nobody declares at all is `VN2005`, which is a
   * different thing to be told.
   */
  it("says nothing about a fragment it cannot see", () => {
    expect(said("run elsewhere(42)")).toEqual([]);
  });
});

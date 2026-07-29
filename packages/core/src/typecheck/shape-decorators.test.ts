import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return its error codes and titles. */
function check(source: string): string[] {
  const { ast } = parse(source);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

const ADDS_ID = `## Adds an id field to whatever it is put on.
deco identified(target: Type) {
  target.addField("id", "string")
}
`;

describe("checking a shape a decorator changed", () => {
  /**
   * The case this was opened for. The decorator runs, so the program has a
   * `User` with an `id`; the checker was looking at one without, and rejected a
   * value the run accepted. A shape decorator was unusable in a file that also
   * checked.
   */
  it("accepts a value carrying the field the decorator added", () => {
    const source = `${ADDS_ID}
@identified
type User { name: string }

const u: User = { name: "a", id: "x" }`;

    expect(check(source)).toEqual([]);
  });

  it("accepts reading that field", () => {
    const source = `${ADDS_ID}
@identified
type User { name: string }

const u: User = { name: "a", id: "x" }
print u.id`;

    expect(check(source)).toEqual([]);
  });

  /** Widening the shape is not the same as opening it. */
  it("still rejects a field nobody added", () => {
    const source = `${ADDS_ID}
@identified
type User { name: string }

const u: User = { name: "a", id: "x", nope: 1 }`;

    const errors = check(source);

    expect(errors[0]).toContain("VN3010");
    expect(errors[0]).toContain("nope");
  });

  it("follows a field taken away as well as one added", () => {
    const source = `## Takes the secret away.
deco redacted(target: Type) {
  target.removeField("secret")
}

@redacted
type User { name: string, secret: string }

const u: User = { name: "a" }
print u.secret`;

    const errors = check(source);

    expect(errors[0]).toContain("VN3010");
    expect(errors[0]).toContain("secret");
  });

  it("leaves an undecorated type alone", () => {
    const source = `${ADDS_ID}
type Other { name: string }

const o: Other = { name: "a", id: "x" }`;

    const errors = check(source);

    expect(errors[0]).toContain("VN3010");
    expect(errors[0]).toContain("id");
  });

  /**
   * A decorator that wraps a function changes nothing the checker can see, so
   * running it would mean executing a body to learn nothing.
   *
   * This one asks a function for a verb only a type has, which is `VN2017` the
   * moment it runs. Its absence is the evidence: at run time the same file
   * reports it.
   */
  it("does not run a decorator that is not on a type", () => {
    const source = `${ADDS_ID}
## Asks a function for a verb only a type has.
deco confused(target: Fn) {
  target.addField("id", "string")
}

@identified
type User { name: string }

@confused
fn f() => 1

const u: User = { name: "a", id: "x" }`;

    const errors = check(source);

    expect(errors.filter((error) => error.includes("VN2017"))).toEqual([]);
    expect(errors.filter((error) => error.includes("addField"))).toEqual([]);
  });

  /**
   * The name is looked up, found nowhere, and left alone. Expansion would
   * normally report it, but the use sites are `checkDeco`'s to report and
   * saying it twice is what a reader sees.
   */
  it("passes over a decorator nothing declares, without reporting it twice", () => {
    const source = `${ADDS_ID}
@nosuchthing
type User { name: string }

const u: User = { name: "a" }`;

    const errors = check(source);

    expect(errors.filter((error) => error.includes("nosuchthing"))).toHaveLength(0);
  });

  it("checks a file with no decorators at all the way it always did", () => {
    expect(check('type User { name: string }\nconst u: User = { name: "a" }')).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const ORDER = `type Order { id: string, total: number }
const order: Order = { id: "a1", total: 42 }
`;

/** Check a program and return what it reported. */
function said(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => problem.title);
}

describe("taking a value apart where it is bound", () => {
  it("gives each name the type of the field it came from", () => {
    const source = `${ORDER}const { id, total } = order
const a: string = id
const b: number = total`;

    expect(said(source)).toEqual([]);
  });

  it("refuses a name given the wrong type", () => {
    const source = `${ORDER}const { total } = order
const a: string = total`;

    expect(said(source)[0]).toContain("expected string, found number");
  });

  /** The whole point: a field nobody carries is a mistake where it is written. */
  it("refuses a field the shape does not carry", () => {
    expect(said(`${ORDER}const { nope } = order`)[0]).toContain('has no field "nope"');
  });

  it("binds a field to another name", () => {
    const source = `${ORDER}const { id: reference } = order
const a: string = reference`;

    expect(said(source)).toEqual([]);
  });

  it("goes on taking apart what it took apart", () => {
    const source = `type City { name: string }
type User { name: string, city: City }
const u: User = { name: "ana", city: { name: "porto" } }
const { city: { name: town } } = u
const a: string = town`;

    expect(said(source)).toEqual([]);
  });

  it("takes a list apart by position", () => {
    const source = `const xs = [1, 2]
const [first, second] = xs
const a: number = first
const b: number = second`;

    expect(said(source)).toEqual([]);
  });

  it("refuses a map pattern over something that is not a map", () => {
    expect(said("const { a } = 5")[0]).toContain("is not a map");
  });

  it("refuses a list pattern over something that is not a list", () => {
    expect(said(`${ORDER}const [a] = order`)[0]).toContain("is not a list");
  });

  /** Nothing is known about it yet, so nothing is claimed. */
  it("says nothing about a value whose shape is unknown", () => {
    const source = `fn show(o) {
  let { a, b } = o
  return a
}`;

    expect(said(source)).toEqual([]);
  });
});

describe("the rest of a value", () => {
  it("says nothing about a list whose shape is unknown", () => {
    const source = `fn show(o) {
  let [first, ...rest] = o
  return first
}`;

    expect(said(source)).toEqual([]);
  });

  it("is the shape without the fields the pattern named", () => {
    const source = `${ORDER}const { id, ...others } = order
const a: number = others.total`;

    expect(said(source)).toEqual([]);
  });

  it("no longer carries what was named", () => {
    const source = `${ORDER}const { id, ...others } = order
print others.id`;

    expect(said(source)[0]).toContain('has no field "id"');
  });

  it("refuses it read as the wrong type", () => {
    const source = `${ORDER}const { id, ...others } = order
const a: string = others.total`;

    expect(said(source)[0]).toContain("expected string, found number");
  });

  /** Taking some keys away changes how many there are, not what they hold. */
  it("keeps a map of one value a map of that value", () => {
    const source = `const headers: map<string> = { a: "1", b: "2" }
const { a, ...rest } = headers
const b: string = rest.get("b")`;

    expect(said(source)).toEqual([]);
  });

  it("is a list of the same thing when it comes off a list", () => {
    const source = `const xs = [1, 2, 3]
const [first, ...rest] = xs
const a: list<number> = rest`;

    expect(said(source)).toEqual([]);
  });

  it("refuses that list read as another", () => {
    const source = `const xs = [1, 2, 3]
const [first, ...rest] = xs
const a: list<string> = rest`;

    expect(said(source)[0]).toContain("expected list<string>, found list<number>");
  });

  it("takes the rest of a value a match arm asked about", () => {
    const source = `${ORDER}const said: number = match order {
  { id: "a1", ...body } => body.total
  _ => 0
}`;

    expect(said(source)).toEqual([]);
  });
});

describe("taking apart what a loop hands over", () => {
  it("gives each name the field's type", () => {
    const source = `const people = [{ name: "ana", age: 30 }]
forEach { name, age } in people {
  const a: string = name
  const b: number = age
}`;

    expect(said(source)).toEqual([]);
  });

  it("refuses a field the item does not carry", () => {
    const source = `const people = [{ name: "ana" }]
forEach { age } in people {
  print age
}`;

    expect(said(source)[0]).toContain('has no field "age"');
  });
});

describe("taking apart what a call hands over", () => {
  it("types a parameter from the annotation on it", () => {
    const source = `${ORDER}fn totalOf({ total }: Order) -> string => total`;

    expect(said(source)[0]).toContain("expected string, found number");
  });

  it("refuses a field the annotation does not carry", () => {
    const source = `${ORDER}fn totalOf({ missing }: Order) -> number => 0`;

    expect(said(source)[0]).toContain('has no field "missing"');
  });

  it("types a fragment's parameter the same way", () => {
    const source = `${ORDER}fragment show({ total }: Order) {
  const a: string = total
}`;

    expect(said(source)[0]).toContain("expected string, found number");
  });

  it("takes apart a local of a function body", () => {
    const source = `${ORDER}fn idOf(o: Order) -> number {
  let { id } = o
  return id
}`;

    expect(said(source)[0]).toContain("expected number, found string");
  });
});

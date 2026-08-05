import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return the titles reported. */
function titles(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => problem.title);
}

describe("a shape written where it is used", () => {
  /** The example §03 carries, which did not parse until now. */
  it("is a field's type", () => {
    const source = `type User { name: string, address: { city: string } }
const u: User = { name: "a", address: { city: "b" } }
print u.address.city`;

    expect(titles(source)).toEqual([]);
  });

  it("is a parameter's type", () => {
    expect(titles("fn who(u: { name: string }) -> string => u.name")).toEqual([]);
  });

  it("is a return type", () => {
    expect(titles("fn make() -> { id: number } => { id: 1 }")).toEqual([]);
  });

  it("is a binding's type", () => {
    expect(titles('const u: { name: string } = { name: "a" }')).toEqual([]);
  });

  it("nests", () => {
    const source = 'const u: { a: { b: { c: string } } } = { a: { b: { c: "x" } } }';

    expect(titles(source)).toEqual([]);
  });

  it("goes inside a generic", () => {
    expect(titles("const xs: list<{ id: number }> = [{ id: 1 }]")).toEqual([]);
  });

  it("stands in a union beside another type", () => {
    expect(titles('const x: { a: number } | string = "a"')).toEqual([]);
  });

  /** Being writable inline must not make it any less checked. */
  it("refuses a field the shape does not have", () => {
    const said = titles('const u: { name: string } = { nome: "a" }');

    expect(said[0]).toBe('This map is missing "name", and has "nome" instead.');
  });

  it("refuses a field of the wrong type", () => {
    expect(titles('const u: { id: number } = { id: "x" }')[0]).toContain("expected { id: number }");
  });

  it("refuses reading a field it does not carry", () => {
    const source = 'const u: { name: string } = { name: "a" }\nprint u.missing';

    expect(titles(source)[0]).toContain('has no field "missing"');
  });

  /**
   * The two spellings are one type, so a value of the named one satisfies the
   * inline one and the other way round.
   */
  it("is the same type as the equivalent named one", () => {
    const source = `type Address { city: string }
fn takesInline(a: { city: string }) -> string => a.city
const named: Address = { city: "b" }
print takesInline(named)`;

    expect(titles(source)).toEqual([]);
  });

  it("carries an optional field the way a named shape does", () => {
    const source = "const u: { name?: string } = { }";

    expect(titles(source)).toEqual([]);
  });
});

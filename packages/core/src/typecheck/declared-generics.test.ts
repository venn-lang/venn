import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** What the checker says about one file, by title. */
function titles(source: string): string[] {
  return checkTypes(parse(source).ast).problems.map((problem) => problem.title);
}

/**
 * `type Box<T>`: a name whose shape is finished by whoever uses it.
 *
 * Generics were usable and not declarable. A `list<number>` written by a plugin
 * worked, and nothing a person wrote in Venn could be generic, so every
 * container written here was either one type or `dynamic`.
 *
 * A `fn` needs no parameters of its own: inference generalises one already, so
 * `fn first(xs) => xs[0]` is used at two element types without saying so. Only
 * a `type` names them, because only a `type` has no body to infer from.
 */
describe("a type declared with parameters", () => {
  it("takes the shape the use site fills in", () => {
    const source = 'type Box<T> = { held: T }\nconst a: Box<string> = { held: "x" }\nprint a.held';

    expect(titles(source)).toEqual([]);
  });

  it("refuses a value that does not fit what was filled in, naming both", () => {
    const source = "type Box<T> = { held: T }\nconst a: Box<string> = { held: 1 }\nprint a";

    expect(titles(source)).toEqual([
      "Type mismatch: expected { held: string }, found { held: number }.",
    ]);
  });

  it("takes more than one parameter, in the order they were written", () => {
    const good = "type Pair<A, B> = { left: A, right: B }";
    const bad = `${good}\nconst p: Pair<string, number> = { left: 1, right: 1 }\nprint p`;

    expect(
      titles(`${good}\nconst p: Pair<string, number> = { left: "a", right: 1 }\nprint p`),
    ).toEqual([]);
    expect(titles(bad)).toEqual([
      "Type mismatch: expected { left: string, right: number }, found { left: number, right: number }.",
    ]);
  });

  it("takes a whole type as an argument", () => {
    const source =
      'type Box<T> = { held: T }\nconst b: Box<list<string>> = { held: ["a"] }\nprint b.held';

    expect(titles(source)).toEqual([]);
  });

  it("takes another generic as an argument", () => {
    const source = [
      "type Box<T> = { held: T }",
      "type Wrap<T> = { inner: Box<T> }",
      "const w: Wrap<number> = { inner: { held: 1 } }",
      "print w.inner.held",
    ].join("\n");

    expect(titles(source)).toEqual([]);
  });

  it("refuses through one generic inside another", () => {
    const source = [
      "type Box<T> = { held: T }",
      "type Wrap<T> = { inner: Box<T> }",
      'const w: Wrap<number> = { inner: { held: "no" } }',
      "print w",
    ].join("\n");

    expect(titles(source)).toEqual([
      "Type mismatch: expected { inner: { held: number } }, found { inner: { held: string } }.",
    ]);
  });

  /** A parameter nobody gave is one for inference to solve, not an error. */
  it("reads without arguments as one of anything", () => {
    const source = 'type Box<T> = { held: T }\nconst b: Box = { held: "anything" }\nprint b.held';

    expect(titles(source)).toEqual([]);
  });

  it("works as an alias, not only as a shape", () => {
    const source = "type Maybe<T> = T | null\nconst m: Maybe<string> = null\nprint m";

    expect(titles(source)).toEqual([]);
  });

  /** The parameter is the body's, so an outer name of the same spelling is not it. */
  it("keeps its parameter to itself", () => {
    const source = [
      "type T = { wrong: number }",
      "type Box<T> = { held: T }",
      'const b: Box<string> = { held: "x" }',
      "print b.held",
    ].join("\n");

    expect(titles(source)).toEqual([]);
  });
});

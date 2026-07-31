import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const SEAT = `type Seat { email: string, plan: string }
const seat: Seat = { email: "a", plan: "pro" }
`;

/** Check a program and return what it reported. */
function said(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => problem.title);
}

describe("pouring a list into a list", () => {
  it("keeps the element type", () => {
    const source = `const xs = [1, 2]
const ys = [0, ...xs, 5]
const a: list<number> = ys`;

    expect(said(source)).toEqual([]);
  });

  it("refuses a list of something else", () => {
    const source = `const xs = [1, 2]
const ys = ["a", ...xs]`;

    expect(said(source)[0]).toContain("expected list<string>, found list<number>");
  });

  it("refuses what is not a list at all", () => {
    expect(said("const ys = [0, ...5]")[0]).toContain("expected list<number>, found number");
  });

  it("is a list of what it poured when that is all there is", () => {
    const source = `const xs = ["a"]
const ys = [...xs]
const a: list<string> = ys`;

    expect(said(source)).toEqual([]);
  });
});

describe("pouring a map into a map", () => {
  it("carries the fields of both", () => {
    const source = `${SEAT}const more = { ...seat, credits: 5 }
const a: string = more.email
const b: number = more.credits`;

    expect(said(source)).toEqual([]);
  });

  /** Later wins, which is what makes `{ ...defaults, … }` read as it looks. */
  it("gives a field written after the spread to the one written last", () => {
    const source = `${SEAT}const changed = { ...seat, plan: 9 }
const a: number = changed.plan`;

    expect(said(source)).toEqual([]);
  });

  it("gives a field poured in after to the spread", () => {
    const source = `${SEAT}const changed = { plan: 9, ...seat }
const a: string = changed.plan`;

    expect(said(source)).toEqual([]);
  });

  it("refuses what is not a map", () => {
    const source = `const xs = [1]
const m = { ...xs, a: 1 }`;

    expect(said(source)[0]).toContain("is not a map, so it cannot be poured into one");
  });

  /** Any field could be the one it overwrote, so nothing can be claimed. */
  it("claims nothing when what it poured is unknown", () => {
    const source = `fn shape(o) {
  let held = { a: 1, ...o }
  return held.whatever
}`;

    expect(said(source)).toEqual([]);
  });

  it("keeps a map of one value a map of that value", () => {
    const source = `const headers: map<string> = { a: "1" }
const more = { ...headers }
const a: string = more.get("b")`;

    expect(said(source)).toEqual([]);
  });
});

describe("merging two maps by name", () => {
  it("gives back both, which no signature could have said", () => {
    const source = `${SEAT}const extra = { credits: 5 }
const both = seat.merge(extra)
const a: number = both.credits
const b: string = both.email`;

    expect(said(source)).toEqual([]);
  });

  it("refuses a field of the merged shape read as the wrong type", () => {
    const source = `${SEAT}const both = seat.merge({ credits: 5 })
const a: number = both.email`;

    expect(said(source)[0]).toContain("expected number, found string");
  });

  /** The whole difference between the two, and now it is in the types. */
  it("replaces a nested map with merge and pours it with mergeDeep", () => {
    const source = `const one = { a: { x: 1 }, b: 2 }
const two = { a: { y: "s" } }
const deep = one.mergeDeep(two)
const x: number = deep.a.x
const y: string = deep.a.y`;

    expect(said(source)).toEqual([]);
  });

  it("leaves the branch it replaced out of a shallow merge", () => {
    const source = `const one = { a: { x: 1 } }
const two = { a: { y: "s" } }
const flat = one.merge(two)
print flat.a.x`;

    expect(said(source)[0]).toContain('has no field "x"');
  });

  it("says nothing about a merge of something unknown", () => {
    const source = `${SEAT}fn shape(o) {
  let both = seat.merge(o)
  return both.whatever
}`;

    expect(said(source)).toEqual([]);
  });

  /** A map with a field of that name answers with the field, not with the verb. */
  it("leaves a map that carries its own merge alone", () => {
    const source = `const holder = { merge: 1 }
const a: number = holder.merge`;

    expect(said(source)).toEqual([]);
  });
});

describe("a verb that takes any number of one thing", () => {
  it("takes as many as it is given", () => {
    expect(said("const xs = [1, 2]\nprint xs.push(3, 4)")).toEqual([]);
  });

  it("still asks that each of them be the one thing", () => {
    expect(said('const xs = [1, 2]\nprint xs.push("a")')[0]).toContain("Type mismatch");
  });

  it("asks the same of a verb of the prelude", () => {
    expect(said('print range(1, "a")')[0]).toContain("Type mismatch");
  });

  it("asks nothing where nothing was said", () => {
    expect(said('print str(1, "a", true)')).toEqual([]);
  });
});

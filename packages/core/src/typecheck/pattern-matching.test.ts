import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const RESULT = `type Ok { kind: "ok", value: number }
type Err { kind: "err", message: string }
type Result = Ok | Err
const r: Result = { kind: "ok", value: 1 }
`;

/** Check a program and return what it reported, code and all. */
function said(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

describe("what a match gives back", () => {
  it("is what every arm agreed on", () => {
    const source = `${RESULT}const said: string = match r {
  { kind: "ok" } => "ok"
  { kind: "err" } => "err"
}`;

    expect(said(source)).toEqual([]);
  });

  it("refuses arms that do not agree", () => {
    const source = `${RESULT}const said = match r {
  { kind: "ok" } => "ok"
  { kind: "err" } => 2
}`;

    expect(said(source)[0]).toContain("expected string, found number");
  });

  it("refuses the whole where the type wanted is another", () => {
    const source = `${RESULT}const said: number = match r {
  { kind: "ok" } => "ok"
  { kind: "err" } => "err"
}`;

    expect(said(source)[0]).toContain("expected number, found string");
  });
});

describe("what an arm is handed", () => {
  /** The pattern tests and binds at once, which is the reason for the syntax. */
  it("binds a name from inside the pattern, with the field's type", () => {
    const source = `${RESULT}const said: string = match r {
  { kind: "ok", value } => str(value)
  { kind: "err", message } => message
}`;

    expect(said(source)).toEqual([]);
  });

  it("gives the bound name the type the field holds", () => {
    const source = `${RESULT}const said = match r {
  { kind: "ok", value } => value.upper
  _ => "x"
}`;

    expect(said(source)[0]).toContain('Type number has no member "upper"');
  });

  /** The subject is one branch inside the arm, so the other's fields are gone. */
  it("refuses a field the branch it narrowed to does not carry", () => {
    const source = `${RESULT}const said = match r {
  { kind: "ok" } => r.message
  _ => "x"
}`;

    expect(said(source)[0]).toContain('does not carry "message"');
  });

  it("takes a list apart by position", () => {
    const source = `const xs = [1, 2]
const said: string = match xs {
  [1, second] => str(second)
  _ => "x"
}`;

    expect(said(source)).toEqual([]);
  });
});

describe("the cases a match claims to cover", () => {
  it("reports the one nobody wrote, by name", () => {
    const source = `${RESULT}const said = match r {
  { kind: "ok" } => "ok"
}`;

    expect(said(source)[0]).toContain('VN3019 Nothing here says what to do when this is "err"');
  });

  it("says nothing when every branch was written", () => {
    const source = `${RESULT}const said = match r {
  { kind: "ok" } => "ok"
  { kind: "err" } => "err"
}`;

    expect(said(source)).toEqual([]);
  });

  /** A name asks nothing, so it takes whatever is left. */
  it("says nothing when a name takes the rest", () => {
    const source = `${RESULT}const said = match r {
  { kind: "ok" } => "ok"
  other => "the rest"
}`;

    expect(said(source)).toEqual([]);
  });

  /**
   * A number is not a list of cases anybody could write out, so asking for one
   * would be asking for the impossible.
   */
  it("asks nothing of a subject that is not a set of branches", () => {
    const source = `const status = 200
const said = match status {
  200 => "ok"
  404 => "gone"
}`;

    expect(said(source)).toEqual([]);
  });

  it("reports an arm nothing can match", () => {
    const source = `${RESULT}const said = match r {
  { kind: "ok" } => "ok"
  { kind: "nope" } => "never"
  _ => "rest"
}`;

    expect(said(source)[0]).toContain("VN3020 Nothing that reaches this arm can match it");
  });

  it("reports an arm written after one that takes everything", () => {
    const source = `${RESULT}const said = match r {
  _ => "everything"
  { kind: "ok" } => "ok"
}`;

    expect(said(source)[0]).toContain("VN3020");
  });
});

describe("an arm written as steps", () => {
  it("is refused where a value is wanted", () => {
    const source = `${RESULT}const said = match r {
  { kind: "ok" } { print "ok" }
  _ => "x"
}`;

    expect(said(source)[0]).toContain("gives nothing back, and a value is wanted here");
  });

  it("is what a match standing on its own is for", () => {
    const source = `${RESULT}match r {
  { kind: "ok", value } {
    print value
  }
  { kind: "err", message } {
    print message
  }
}`;

    expect(said(source)).toEqual([]);
  });

  it("is checked inside, like any other block", () => {
    const source = `${RESULT}match r {
  { kind: "ok", value } {
    const n: string = value
  }
  _ { print "x" }
}`;

    expect(said(source)[0]).toContain("expected string, found number");
  });
});

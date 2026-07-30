import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** The shapes every case below decides between. */
const RESULT = `type Ok { kind: "ok", value: number }
type Err { kind: "err", message: string }
type Result = Ok | Err
`;

const MSG = `type Ping { kind: "ping" }
type Pong { kind: "pong" }
type Close { kind: "close", why: string }
type Msg = Ping | Pong | Close
const m: Msg = { kind: "ping" }
`;

/** Check a program and return what it reported, code and all. */
function said(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

describe("narrowing a union by its discriminant", () => {
  it("reads the field the branch it narrowed to carries", () => {
    const source = `${RESULT}fragment show(r: Result) {
  if r.kind == "ok" {
    print r.value
  } else {
    print r.message
  }
}`;

    expect(said(source)).toEqual([]);
  });

  it("refuses the field the other branch carries", () => {
    const source = `${RESULT}fragment show(r: Result) {
  if r.kind == "ok" {
    print r.message
  }
}`;

    expect(said(source)[0]).toContain('has no field "message"');
  });

  it("gives the field its real type, not dynamic", () => {
    const source = `${RESULT}fragment show(r: Result) {
  if r.kind == "ok" {
    const n: string = r.value
  }
}`;

    expect(said(source)[0]).toContain("expected string, found number");
  });

  /** The `else` of the last branch is what is left, which is one shape here. */
  it("leaves the else with everything no branch took", () => {
    const source = `${MSG}if m.kind == "ping" {
  print "ping"
} else if m.kind == "pong" {
  print "pong"
} else {
  print m.why
}`;

    expect(said(source)).toEqual([]);
  });

  it("narrows the other way round for !=", () => {
    const source = `${RESULT}fragment show(r: Result) {
  if r.kind != "ok" {
    print r.message
  } else {
    print r.value
  }
}`;

    expect(said(source)).toEqual([]);
  });

  it("reads the value written on either side of the comparison", () => {
    const source = `${RESULT}fragment show(r: Result) {
  if "ok" == r.kind {
    print r.value
  }
}`;

    expect(said(source)).toEqual([]);
  });

  it("narrows by both halves of an &&", () => {
    const source = `${RESULT}fragment show(r: Result) {
  if r.kind == "ok" && r.kind != "err" {
    print r.value
  }
}`;

    expect(said(source)).toEqual([]);
  });

  /** A `fn` body is one expression, so this is where a pure function decides. */
  it("narrows both sides of a ternary", () => {
    const source = `${RESULT}fn describe(r: Result) -> string => r.kind == "ok" ? str(r.value) : r.message`;

    expect(said(source)).toEqual([]);
  });

  it("refuses the wrong side of a ternary", () => {
    const source = `${RESULT}fn describe(r: Result) -> string => r.kind == "ok" ? r.message : "no"`;

    expect(said(source)[0]).toContain('has no field "message"');
  });

  it("narrows what a function will take", () => {
    const source = `${RESULT}fn onOk(o: Ok) -> string => str(o.value)
fn describe(r: Result) -> string => r.kind == "ok" ? onOk(r) : r.message`;

    expect(said(source)).toEqual([]);
  });

  it("refuses what the other branch cannot be", () => {
    const source = `${RESULT}fn onOk(o: Ok) -> string => str(o.value)
fn describe(r: Result) -> string => r.kind == "ok" ? "yes" : onOk(r)`;

    expect(said(source)[0]).toContain("Type mismatch");
  });

  it("narrows a union of values by the value itself", () => {
    const source = `fn shout(word: "hi") -> string => word
const greeting: "hi" | "bye" = "hi"
if greeting == "hi" {
  print shout(greeting)
}`;

    expect(said(source)).toEqual([]);
  });
});

describe("what an annotation is worth here", () => {
  /**
   * Without this a union cannot be built: two calls that each return one of its
   * shapes would return two different things, and a list of them would not be a
   * list of anything.
   */
  it("hands callers the type the function said, not the one it built", () => {
    const source = `${RESULT}fn ok(value: number) -> Result => { kind: "ok", value: value }
fn err(message: string) -> Result => { kind: "err", message: message }
const both: list<Result> = [ok(1), err("boom")]`;

    expect(said(source)).toEqual([]);
  });

  it("still checks the body against what was promised", () => {
    const source = `${RESULT}fn ok() -> Result => "not a result"`;

    expect(said(source)[0]).toContain("Type mismatch");
  });

  /** A fragment is called by name from a flow, so nothing else can tell it. */
  it("is the only thing a fragment's parameter has to go on", () => {
    const source = `${RESULT}fragment show(r: Result) {
  const n: number = r.kind
}`;

    expect(said(source)[0]).toContain("expected number");
  });
});

describe("a field the branches do not agree on", () => {
  it("is the union of what every branch holds", () => {
    const source = `${RESULT}fragment show(r: Result) {
  const k: number = r.kind
}`;

    expect(said(source)[0]).toContain('expected number, found "ok" | "err"');
  });

  it("is reported when only some branches carry it", () => {
    const source = `${RESULT}fragment show(r: Result) {
  print r.value
}`;

    expect(said(source)[0]).toContain('does not carry "value" on every branch');
  });

  /** `?.` asks whether something is there, so "no" is an answer. */
  it("is an answer rather than an accusation for ?.", () => {
    const source = `${RESULT}fragment show(r: Result) {
  print r?.value
}`;

    expect(said(source)).toEqual([]);
  });

  /**
   * Two things a value could be, rather than two shapes anyone decides between.
   * Reading one has always been the run's business and stays that way.
   */
  it("is left alone when the branches are not shapes", () => {
    const source = `const counts = ["a", "b"].countBy(w => w)
forEach entry in counts.entries {
  print entry[0].padEnd(8)
}`;

    expect(said(source)).toEqual([]);
  });
});

describe("a case nobody wrote", () => {
  it("is reported, by name", () => {
    const source = `${MSG}if m.kind == "ping" {
  print "ping"
} else if m.kind == "pong" {
  print "pong"
}`;

    expect(said(source)[0]).toContain('VN3019 Nothing here says what to do when m.kind is "close"');
  });

  it("lists every one of them when several are missing", () => {
    const source = `${MSG}if m.kind == "ping" {
  print "one"
} else if m.kind == "ping" {
  print "two"
}`;

    expect(said(source).join("\n")).toContain('m.kind is "pong" or "close"');
  });

  it("is not reported when an else catches the rest", () => {
    const source = `${MSG}if m.kind == "ping" {
  print "ping"
} else if m.kind == "pong" {
  print "pong"
} else {
  print "rest"
}`;

    expect(said(source)).toEqual([]);
  });

  it("is not reported when every case was written", () => {
    const source = `${MSG}if m.kind == "ping" {
  print "ping"
} else if m.kind == "pong" {
  print "pong"
} else if m.kind == "close" {
  print "close"
}`;

    expect(said(source)).toEqual([]);
  });

  /** One `if` asks a question. It is a chain that claims to list the answers. */
  it("is not reported for a single if", () => {
    const source = `${MSG}if m.kind == "ping" {
  print "ping"
}`;

    expect(said(source)).toEqual([]);
  });

  /** There is no list of cases to be missing from: any text at all is one. */
  it("is not reported for a chain over something that is not a union", () => {
    const source = `const name = "ana"
if name == "ana" {
  print "one"
} else if name == "bea" {
  print "two"
}`;

    expect(said(source)).toEqual([]);
  });

  it("is not reported when the union's branches carry no such value", () => {
    const source = `const mixed: string | number = "a"
if mixed == "a" {
  print "one"
} else if mixed == "b" {
  print "two"
}`;

    expect(said(source)).toEqual([]);
  });

  it("is not reported when the branches ask about different things", () => {
    const source = `${MSG}const other: Msg = { kind: "pong" }
if m.kind == "ping" {
  print "ping"
} else if other.kind == "pong" {
  print "pong"
}`;

    expect(said(source)).toEqual([]);
  });
});

describe("a case that cannot happen", () => {
  it("is reported when the union never carries that value", () => {
    const source = `${MSG}if m.kind == "nope" {
  print "never"
}`;

    expect(said(source)[0]).toContain('VN3020 m.kind is never "nope" here, so this never runs');
  });

  it("is reported when an earlier branch already took it", () => {
    const source = `${MSG}if m.kind == "ping" {
  print "one"
} else if m.kind == "ping" {
  print "two"
} else {
  print "rest"
}`;

    expect(said(source)[0]).toContain('VN3020 m.kind is never "ping" here');
  });

  it("is reported for one shape as well as for a union", () => {
    const source = `type Ok { kind: "ok", value: number }
const o: Ok = { kind: "ok", value: 1 }
if o.kind == "err" {
  print "never"
}`;

    expect(said(source)[0]).toContain('o.kind is never "err" here');
  });

  /** Neither side is written out, so neither says what the other one is. */
  it("says nothing about two names compared to each other", () => {
    const source = `${MSG}const other: Msg = { kind: "pong" }
if m.kind == other.kind {
  print "same"
}`;

    expect(said(source)).toEqual([]);
  });

  it("says nothing about an ordinary comparison", () => {
    const source = `const name = "ana"
if name == "bea" {
  print "no"
}`;

    expect(said(source)).toEqual([]);
  });

  it("says nothing when the branch is still possible", () => {
    const source = `${MSG}if m.kind == "close" {
  print m.why
}`;

    expect(said(source)).toEqual([]);
  });
});

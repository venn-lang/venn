import { describe, expect, it } from "vitest";
import { parse } from "../../parse/index.js";
import { checkTypes } from "../../typecheck/index.js";
import { evaluate } from "../evaluate.js";
import { display } from "../prelude.js";

const AT = "2026-07-23T12:00:00Z";

/** Evaluate one expression about a moment, the way a program would write it. */
function value(expr: string): unknown {
  const { ast } = parse(`const t = ${AT}\nconst u = 2026-07-24T18:30:00Z\nprint ${expr}`);
  const bindings: Record<string, unknown> = {};
  const env = { lookup: (name: string) => bindings[name] };
  for (const decl of ast.decls) {
    const binding = decl as { $type: string; name?: string; value?: never };
    if (binding.$type === "LetStmt" && binding.name) {
      bindings[binding.name] = evaluate(binding.value as never, env);
    }
  }
  const last = ast.decls[ast.decls.length - 1] as unknown as { args: never[] };
  return evaluate(last.args[0] as never, env);
}

/** What the checker says, which is the other half of a member existing. */
function said(source: string): string[] {
  const { ast } = parse(`const t = ${AT}\n${source}`);
  return checkTypes(ast).problems.map((problem) => problem.title);
}

describe("what a moment answers about itself", () => {
  it("reads back the text it was written as", () => {
    expect(value("t.iso")).toBe(AT);
    expect(value("t.epochMs")).toBe(Date.parse(AT));
  });

  it("gives up every part, counting months from one", () => {
    expect(value("t.year")).toBe(2026);
    expect(value("t.month")).toBe(7);
    expect(value("t.day")).toBe(23);
    expect(value("t.hour")).toBe(12);
    expect(value("t.minute")).toBe(0);
    expect(value("t.second")).toBe(0);
    expect(value("u.minute")).toBe(30);
  });

  it("reads back what it was written as, and what it is held as", () => {
    expect(value("u.iso")).toBe("2026-07-24T18:30:00Z");
    expect(value("u.epochMs")).toBe(Date.parse("2026-07-24T18:30:00Z"));
  });

  /** 1 is Monday, as everywhere that counts days rather than naming them. */
  it("counts the weekday from Monday, including Sunday as seven", () => {
    expect(value("t.weekday")).toBe(4);
    expect(value("2026-07-26T00:00:00Z.weekday")).toBe(7);
  });

  it("splits into the day and the time of day", () => {
    expect(value("t.date")).toBe("2026-07-23");
    expect(value("t.time")).toBe("12:00:00");
  });
});

describe("arithmetic on a moment", () => {
  it("moves by the durations the language already has", () => {
    expect(value("t.plus(2h).hour")).toBe(14);
    expect(value("t.minus(24h).day")).toBe(22);
  });

  it("measures the distance as a duration", () => {
    expect(value("t.until(u).hours")).toBe(30.5);
  });

  /** Subtraction disagrees when it is turned round, and so does this. */
  it("measures it as negative the other way", () => {
    expect(value("u.until(t).hours")).toBe(-30.5);
  });

  it("says which came first", () => {
    expect(value("t.isBefore(u)")).toBe(true);
    expect(value("t.isAfter(u)")).toBe(false);
    expect(value("t.isBefore(t)")).toBe(false);
  });
});

describe("what the checker knows about one", () => {
  it("types the parts as numbers and the text as text", () => {
    expect(said("const n: number = t.year")).toEqual([]);
    expect(said("const s: string = t.iso")).toEqual([]);
  });

  it("refuses a part read as the wrong type", () => {
    expect(said("const s: string = t.year")[0]).toContain("expected string, found number");
  });

  it("types the arithmetic, both what it takes and what it gives", () => {
    expect(said("const later: instant = t.plus(2h)")).toEqual([]);
    expect(said("const gap: duration = t.until(t)")).toEqual([]);
  });

  /** It is held as a shape with an `epochMs` in it, and that is nobody's business. */
  it("does not answer for the shape holding it", () => {
    expect(value("t.kind")).toBeUndefined();
    expect(said("print t.kind")[0]).toContain('has no member "kind"');
  });

  it("refuses a member a moment does not have", () => {
    expect(said("print t.nope")[0]).toContain('has no member "nope"');
  });
});

describe("printing one", () => {
  /** How it is held is nobody's business, and it used to print as the object. */
  it("shows the moment, not the shape holding it", () => {
    expect(display(value("t"))).toBe(AT);
  });

  it("shows one that arithmetic built, too", () => {
    expect(display(value("t.plus(2h)"))).toContain("14:00:00");
  });
});

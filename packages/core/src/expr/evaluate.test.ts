import { describe, expect, it } from "vitest";
import type { ExpectStmt, Expr, FlowDecl, StepDecl } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import type { EvalEnv } from "./eval-env.types.js";
import { evaluate } from "./evaluate.js";

/** Dig the subject expression out of `flow { step { expect <source> } }`. */
function subjectExpr(source: string): Expr {
  const { ast, problems } = parse(`flow "t" { step "s" { expect ${source} } }`);
  if (problems.length > 0) throw new Error(problems.map((p) => p.title).join("; "));
  const flow = ast.decls[0] as FlowDecl;
  const step = flow.body.stmts[0] as StepDecl;
  const expectStmt = step.body.stmts[0] as ExpectStmt;
  if (!expectStmt.subject) throw new Error("no subject expression parsed");
  return expectStmt.subject;
}

const withRes = (res: unknown): EvalEnv => ({
  lookup: (name) => (name === "res" ? res : undefined),
});

describe("evaluate", () => {
  it("evaluates res.status == 200 to true when it matches", () => {
    expect(evaluate(subjectExpr("res.status == 200"), withRes({ status: 200 }))).toBe(true);
  });

  it("evaluates res.status == 200 to false when it differs", () => {
    expect(evaluate(subjectExpr("res.status == 200"), withRes({ status: 500 }))).toBe(false);
  });

  it("short-circuits && and ||", () => {
    const env = withRes(undefined);
    expect(evaluate(subjectExpr("true && false"), env)).toBe(false);
    expect(evaluate(subjectExpr("false || true"), env)).toBe(true);
  });

  it("compares durations with units", () => {
    expect(evaluate(subjectExpr("300ms < 1s"), withRes(undefined))).toBe(true);
  });

  it("reads nested members", () => {
    const env = withRes({ json: { token: "abc" } });
    expect(evaluate(subjectExpr('res.json.token == "abc"'), env)).toBe(true);
  });

  it("interpolates placeholders in strings", () => {
    const env = withRes({ email: "a@b.com", total: 99 });
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(evaluate(subjectExpr('"hi ${res.email} — ${res.total}"'), env)).toBe("hi a@b.com — 99");
  });

  it("matches with the ~= operator", () => {
    const env = withRes({ body: "Order #42 confirmed" });
    expect(evaluate(subjectExpr('res.body ~= "Order #[0-9]+"'), env)).toBe(true);
    expect(evaluate(subjectExpr('res.body ~= "^Refund"'), env)).toBe(false);
  });

  /** A raw string is the form to write a pattern in: every backslash survives. */
  it("matches a pattern written as a raw string", () => {
    const env = withRes({ body: "Order #42 confirmed" });
    expect(evaluate(subjectExpr('res.body ~= r"Order #(\\d+)"'), env)).toBe(true);
    expect(evaluate(subjectExpr('res.body ~= r"(?i:ORDER)"'), env)).toBe(true);
  });

  /**
   * A pattern that does not compile used to answer `false`, which reads as "it
   * did not match" and sends whoever wrote it looking at the subject.
   */
  it("refuses a pattern that does not compile, rather than saying no match", () => {
    const env = withRes({ body: "anything" });

    expect(() => evaluate(subjectExpr('res.body ~= "[unclosed"'), env)).toThrow(/not a pattern/);
  });

  it("parses an instant literal into an Instant value", () => {
    const result = evaluate(subjectExpr("2026-07-23T12:00:00Z"), withRes(undefined));
    expect(result).toMatchObject({ kind: "instant", iso: "2026-07-23T12:00:00Z" });
  });
});

// Plain numbers skip the unit machinery. These pin the shortcut to the long
// way round: whatever `combine` decided before, it must still decide.
describe("arithmetic on plain numbers", () => {
  const at = (source: string): unknown =>
    evaluate(subjectExpr(source), { lookup: () => undefined });

  it("agrees with the unit path on every operator", () => {
    expect(at("7 + 2")).toBe(9);
    expect(at("7 - 2")).toBe(5);
    expect(at("7 * 2")).toBe(14);
    expect(at("7 / 2")).toBe(3.5);
    expect(at("7 % 2")).toBe(1);
  });

  it("compares without coercing", () => {
    expect(at("2 < 7")).toBe(true);
    expect(at("7 <= 7")).toBe(true);
    expect(at("2 > 7")).toBe(false);
    expect(at("7 >= 7")).toBe(true);
    expect(at("7 == 7")).toBe(true);
    expect(at("7 != 7")).toBe(false);
  });

  it("divides by zero the way JavaScript does, not by throwing", () => {
    expect(at("1 / 0")).toBe(Number.POSITIVE_INFINITY);
  });

  // The shortcut must not swallow units: these are not plain numbers.
  it("still routes units through the unit path", () => {
    expect(at("300ms + 1s")).toEqual({ kind: "duration", ms: 1300 });
    expect(at("2mb > 1kb")).toBe(true);
  });

  it("still reports a unit mismatch", () => {
    expect(() => at("300ms + 2mb")).toThrow(/VN3012|Cannot combine/);
  });
});

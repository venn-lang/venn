import { describe, expect, it } from "vitest";
import type { FlowDecl, StepDecl } from "../generated/ast.js";
import { parse } from "./parse.js";

const HELLO = `module demo.hello
use "@venn/http"
use "@venn/assert"

flow "Hello" {
  step "Ping" {
    http.get "https://example.com/health"
    expect res.status == 200
  }
}`;

describe("parse", () => {
  it("parses the hello.vn slice with no problems", () => {
    const { ast, problems } = parse(HELLO);
    expect(problems).toEqual([]);
    expect(ast.name).toBe("demo.hello");
    expect(ast.imports).toHaveLength(2);
    expect(ast.decls).toHaveLength(1);
  });

  it("exposes the flow, step and action structure", () => {
    const { ast } = parse(HELLO);
    const flow = ast.decls[0] as FlowDecl;
    expect(flow.$type).toBe("FlowDecl");
    expect(flow.title).toBe("Hello");
    const step = flow.body.stmts[0] as StepDecl;
    expect(step.title).toBe("Ping");
    expect(step.body.stmts[0]?.$type).toBe("ActionCall");
    expect(step.body.stmts[1]?.$type).toBe("ExpectStmt");
  });

  it("reports VN1xxx problems on a syntax error", () => {
    const { problems } = parse(`flow "Broken" { step "s" {`);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]?.code).toMatch(/^VN1/);
  });
});

describe("digit separators", () => {
  it("lexes a grouped number as one token", () => {
    const { problems } = parse("const a = 1_000_000\nconst b = 9_999.999_9\nconst c = 1_500ms\n");

    expect(problems).toEqual([]);
  });

  // `_` opens an identifier, so a leading one is a name, not a number.
  it("does not let a separator start a number", () => {
    const { ast } = parse("const a = _1\n");
    const decl = (ast as { decls: { value?: { $type?: string } }[] }).decls[0];

    expect(decl?.value?.$type).toBe("Ref");
  });
});

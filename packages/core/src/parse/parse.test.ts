import { describe, expect, it } from "vitest";
import type { FlowDecl, StepDecl } from "../generated/ast.js";
import { parse } from "./parse.js";

const HELLO = `module demo.hello
import { http } from "venn/http"
import { assert } from "venn/assert"

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

/**
 * A file names what it brings in at the top, above everything that uses it.
 * The parser's whole account of breaking that rule was "Expecting token of type
 * 'EOF' but found `import`", which states a fact about the grammar and no rule
 * anybody could follow.
 */
describe("an import written out of place", () => {
  it("says where every import goes", () => {
    const found = parse('flow "f" {}\nimport { a } from "./b.vn"').problems;

    expect(found[0]?.title).toBe(
      "Every `import` goes at the top of the file, above the first declaration.",
    );
    expect(found[0]?.span.line).toBe(2);
  });

  it("counts a `module` line and another import as still being the top", () => {
    const found = parse(
      'module a\nimport { b } from "./b.vn"\nimport { c } from "./c.vn"',
    ).problems;

    expect(found).toEqual([]);
  });

  /** One the parser refuses on line one is written wrong, not written late. */
  it("says the shape of an import it could not read at all", () => {
    const found = parse('import a + b from "x"').problems;

    expect(found[0]?.title).toBe(
      'An `import` names what it brings in: `import { one, two } from "./file.vn"`.',
    );
  });

  /**
   * Three problems came out of `import a + b from "x"`, and the second and the
   * third said the file should have ended before the very thing the first had
   * just said where to put. After a refused `import` the grammar only ever
   * wants the end of the file, so all of that is the wake of one mistake.
   */
  it("reports one mistake once", () => {
    expect(parse('import a + b from "x"').problems).toHaveLength(1);
    expect(parse('flow "f" {}\nimport { a } from "./b.vn"').problems).toHaveLength(1);
  });
});

/**
 * A file the parser ran off the end of.
 *
 * The token for the end of the file carries `NaN` for its position, which fell
 * back to the top of the file, so a five-line file with an unclosed `{` on line
 * four was told about its closing brace at `1:1`. The words are new and true,
 * and pointing them at line one made them read as a claim.
 */
describe("a brace nobody closed", () => {
  it("points at the end of the file it says it found", () => {
    const source = 'flow "F" {\n  step "s" {\n    print 1\n  }\n  step "t" foo\n';
    const found = parse(source).problems;
    const ended = found.find((problem) => problem.title.includes("end of the file"));

    expect(ended?.title).toBe("Expected a closing brace here, found the end of the file.");
    expect(ended?.span.line).toBe(6);
    expect(ended?.span.column).toBe(1);
  });

  it("still points at a token when there is one to point at", () => {
    const found = parse('flow "x" constructor').problems;

    expect(found[0]?.span.line).toBe(1);
    expect(found[0]?.span.column).toBe(10);
  });
});

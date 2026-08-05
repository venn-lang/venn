import { describe, expect, it } from "vitest";
import type { Closure } from "../expr/closure.types.js";
import type { EvalEnv } from "../expr/eval-env.types.js";
import { callClosure } from "../expr/invoke.js";
import type { Document, FnDecl, FragmentDecl, Statement } from "../generated/ast.js";
import { isFnDecl } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { closureOfDecl } from "./compile.js";
import { rootScope } from "./lex-scope.js";
import { compileStep } from "./nodes/index.js";

const NEWLINE = String.fromCharCode(10);

/** A program written as lines, the way a body has to be. */
function program(...lines: string[]): string {
  return lines.join(NEWLINE);
}

/** What the parser had to say about a program, which is what a reader sees. */
function refusals(source: string): string[] {
  return parse(source).problems.map((problem) => problem.title);
}

/** Parse a program and call one of its `fn`s. */
function call(source: string, name: string, args: unknown[]): unknown {
  const document = parse(source).ast as Document;
  const bindings: Record<string, Closure> = {};
  const env: EvalEnv = { lookup: (bound) => bindings[bound] };
  for (const decl of document.decls) {
    if (isFnDecl(decl)) bindings[decl.name] = closureOfDecl(decl as FnDecl, env);
  }
  return callClosure(bindings[name] as Closure, args);
}

/**
 * A `fn` body is pure all the way down.
 *
 * What a pure body may hold was listed once, at the top of the body, and the
 * blocks those statements held were any block at all. So a verb one level in
 * parsed: the body compiler had no case for it, the block read the answer as
 * "stopped here", and the function ended where it stood. It printed nothing and
 * handed back `null`, and the file checked clean the whole time.
 *
 * The blocks inside a body are made of the body's own statements now, so a verb
 * is refused wherever it is written, which is the one rule said once instead of
 * once per depth. Where that refusal comes from is no longer here: the grammar
 * parses the verb and the checker names it, and the compiler's own floor under
 * both is exercised in `a-fn-may-fail.test.ts`. What is left here is the other
 * half of the same rule, that everything a pure body MAY hold still runs at
 * every depth.
 */
describe("a fn body that is pure all the way down", () => {
  it("fails from inside an if, where a verb is still refused", () => {
    const source = program(
      "fn average(mark) {",
      "  if mark > 100 {",
      '    fail "out of range" { code: "grade.outOfRange" }',
      "  }",
      "  return mark",
      "}",
    );

    expect(refusals(source)).toEqual([]);
    expect(call(source, "average", [50])).toBe(50);
  });

  it("still runs the statements a pure body may hold, however deep they sit", () => {
    const source = program(
      "fn firstOver(rows, floor) {",
      "  repeat 2 as pass {",
      "    forEach row in rows {",
      "      if row.n > floor {",
      "        return row.n + pass",
      "      }",
      "    }",
      "  }",
      "  return 0",
      "}",
    );

    // 9 on the first pass, and a pass is counted from one.
    expect(call(source, "firstOver", [[{ n: 1 }, { n: 9 }], 4])).toBe(10);
    expect(call(source, "firstOver", [[{ n: 1 }], 4])).toBe(0);
  });

  it("goes on to the next pass from a continue three blocks in", () => {
    const source = program(
      "fn oddsOnly(rows) {",
      "  let sum = 0",
      "  forEach row in rows {",
      "    forEach n in row {",
      "      if n % 2 == 0 {",
      "        continue",
      "      }",
      "      sum = sum + n",
      "    }",
      "  }",
      "  return sum",
      "}",
    );

    const rows = [
      [1, 2],
      [3, 4, 5],
    ];

    expect(call(source, "oddsOnly", [rows])).toBe(9);
  });
});

/**
 * The floor under the rule: a statement the body compiler has no case for is
 * refused where it is compiled, rather than standing still.
 *
 * Standing still is what it used to do, and it is what made a verb inside an
 * `if` compile to nothing: the block carried on, the body reported success, and
 * nothing anywhere said a word. Loud at compile time instead, so the next person
 * to widen `FnStmt` meets it where they are working.
 */
describe("a statement the body compiler does not know", () => {
  it("refuses a verb rather than compiling it to nothing", () => {
    const source = program("fragment shouts() {", '  print "loud"', "}");
    const body = (parse(source).ast as Document).decls[0] as FragmentDecl;
    const stmt = body.body.stmts[0] as Statement;

    expect(() => compileStep(stmt, rootScope(), () => () => null)).toThrow(
      "it cannot call `print`",
    );
  });
});

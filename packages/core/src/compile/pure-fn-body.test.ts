import { describe, expect, it } from "vitest";
import type { Closure } from "../expr/closure.types.js";
import type { EvalEnv } from "../expr/eval-env.types.js";
import type { Frame } from "../expr/frame.js";
import { callClosure } from "../expr/invoke.js";
import type { Document, FnDecl, FragmentDecl, Statement } from "../generated/ast.js";
import { isFnDecl } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { closureOfDecl } from "./compile.js";
import { rootScope } from "./lex-scope.js";
import { compileStep, RAN } from "./nodes/index.js";

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
 * once per depth.
 */
describe("a fn body that is pure all the way down", () => {
  it("refuses a verb inside an if, where it used to be ignored", () => {
    const source = program(
      "fn shouts(n) {",
      "  if n > 10 {",
      '    print "inside a fn"',
      "  }",
      "  return n",
      "}",
    );

    expect(refusals(source)[0]).toContain("A `fn` is pure, so it cannot call `print`.");
  });

  it("refuses one inside a loop, and inside an else", () => {
    const looped = program(
      "fn f(xs) {",
      "  forEach x in xs {",
      "    print x",
      "  }",
      "  return xs",
      "}",
    );
    const otherwise = program(
      "fn f(n) {",
      "  if n > 10 {",
      "    return n",
      "  } else {",
      '    print "small"',
      "  }",
      "  return 0",
      "}",
    );

    expect(refusals(looped)[0]).toContain("it cannot call `print`");
    expect(refusals(otherwise)[0]).toContain("it cannot call `print`");
  });

  /** The refusal in #221 was written as `fail`, which is a verb like any other. */
  it("refuses a fail, since deciding it is not a verb is a language decision", () => {
    const source = program(
      "fn average(mark) {",
      "  if mark > 100 {",
      '    fail "out of range" { code: "grade.outOfRange" }',
      "  }",
      "  return mark",
      "}",
    );

    expect(refusals(source)[0]).toContain("it cannot call `fail`");
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
 * The floor under the rule: a statement the body compiler has no case for stands
 * still, rather than answering that the block it is in has stopped.
 *
 * Standing still is the only safe answer. Stopping is what a `return` says, and
 * a body that stops without having left a value hands back `null`, which is the
 * failure in #221 read from the other end.
 */
describe("a statement the body compiler does not know", () => {
  it("stands still rather than stopping the block it is in", () => {
    const source = program("fragment shouts() {", '  print "loud"', "}");
    const body = (parse(source).ast as Document).decls[0] as FragmentDecl;

    const step = compileStep(body.body.stmts[0] as Statement, rootScope(), () => () => null);

    expect(step({ left: undefined } as unknown as Frame)).toBe(RAN);
  });
});

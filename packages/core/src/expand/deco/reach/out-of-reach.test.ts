import { describe, expect, it } from "vitest";
import { parse } from "../../../parse/index.js";
import type { Problem } from "../../../problem/index.js";
import { expand } from "../../expand.js";

const NOTHING = { get: () => undefined, names: () => [] };

function run(lines: readonly string[]): Problem[] {
  const { ast, problems } = parse(lines.join("\n"), { uri: "/main.vn" });
  expect(problems).toEqual([]);
  return expand({ document: ast, decorators: NOTHING, uri: "/main.vn" }).problems;
}

const codes = (problems: readonly Problem[]) => problems.map((one) => one.code);

/**
 * A `deco` body runs before the program exists, so a name at the top of the file
 * has no value for it to read. That is the language, and it stays. What was
 * wrong was the silence: the name read as nothing, an interpolation printed
 * empty, and a call on it arrived later as a message from the machine.
 *
 * A hook is not the body. `target.wrap(fn (call, args) { … })` hands a value
 * over and the value is called once the program is running, so a name it reads
 * is the program's to answer. The line between the two is what these hold.
 */
describe("a name a `deco` body cannot reach is refused where it is written", () => {
  it("refuses a top-level `const` the body itself reads", () => {
    const problems = run([
      "const outer = 5",
      "deco a(target: Fn) {",
      '  target.meta "seen" outer',
      "}",
      "@a",
      "fn double(n) => n * 2",
    ]);

    expect(codes(problems)).toEqual(["VN2023"]);
    expect(problems[0]?.title).toBe(
      "`outer` is out of reach here: a decorator runs before the program exists.",
    );
  });

  it("points at the placeholder, not at the string around it", () => {
    const problems = run([
      "const outer = 5",
      "deco a(target: Fn) {",
      '  target.meta "seen" "outer is [${outer}]"',
      "}",
    ]);

    expect(problems[0]?.span.line).toBe(3);
    // The eight characters of the placeholder, and none of the text beside it.
    expect(problems[0]?.span.length).toBe(8);
  });

  it("says nothing about a top-level `const` a hook reads", () => {
    const problems = run([
      "const outer = 5",
      "deco a(target: Fn) {",
      '  target.wrap(fn (call, args) => "outer is [${outer}]")',
      "}",
      "@a",
      "fn double(n) => n * 2",
    ]);

    expect(problems).toEqual([]);
  });

  it("says nothing about a top-level function a hook would call", () => {
    const problems = run([
      "fn shout(x) => x",
      "deco a(target: Fn) {",
      "  target.wrap(fn (call, args) => shout(call(args)))",
      "}",
    ]);

    expect(problems).toEqual([]);
  });

  it("says nothing about the decorator's own parameters", () => {
    const problems = run([
      "deco times(target: Fn, factor: number) {",
      "  target.wrap(fn (call, args) => call(args) * factor)",
      "}",
    ]);

    expect(problems).toEqual([]);
  });

  it("says nothing about a `const` the body binds itself", () => {
    const problems = run([
      "deco a(target: Fn) {",
      "  const tag = 2",
      "  target.wrap(fn (call, args) => call(args) * tag)",
      "}",
    ]);

    expect(problems).toEqual([]);
  });

  it("says nothing about a name a closure inside it binds", () => {
    const problems = run([
      "deco a(target: Fn) {",
      "  target.wrap(fn (call, args) => args.map(fn (one) => one))",
      "}",
    ]);

    expect(problems).toEqual([]);
  });

  it("says nothing about the prelude", () => {
    const problems = run([
      "deco a(target: Fn) {",
      "  target.wrap(fn (call, args) => str(call(args)))",
      "}",
    ]);

    expect(problems).toEqual([]);
  });

  /** One line, one sentence: the binding is already refused for calling out. */
  it("leaves a statement it already refuses to the problem it already has", () => {
    const problems = run([
      "deco a(target: Fn) {",
      '  let page = http.get "u"',
      "}",
      "@a",
      "fn double(n) => n * 2",
    ]);

    expect(codes(problems)).toEqual(["VN2016"]);
  });

  /**
   * The line, in one program. The same name is written twice, once where the
   * body reads it and once where a hook does, and exactly one of them is a
   * mistake about when it runs.
   */
  it("refuses the read the body makes and leaves the one a hook makes", () => {
    const problems = run([
      "const outer = 5",
      "deco a(target: Fn) {",
      "  target.wrap(fn (call, args) => outer)",
      '  target.meta "seen" outer',
      "}",
    ]);

    expect(codes(problems)).toEqual(["VN2023"]);
    expect(problems[0]?.span.line).toBe(4);
    expect(problems[0]?.help).toContain("its own parameters");
  });
});
